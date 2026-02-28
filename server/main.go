package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// Card 信用卡数据结构（存储加密后的数据）
type Card struct {
	ID             json.Number `json:"id"`
	SyncID         string      `json:"syncId"`
	Name           string      `json:"name"`
	Bank           string      `json:"bank"`
	CardNumber     string      `json:"cardNumber"`
	CVV            string      `json:"cvv"`
	ExpiryDate     string      `json:"expiryDate"`
	CardholderName string      `json:"cardholderName"`
	CreditLimit    float64     `json:"creditLimit"`
	BillingDay     int         `json:"billingDay"`
	PaymentDueDay  int         `json:"paymentDueDay"`
	Color          string      `json:"color"`
	CardFrontImage string      `json:"cardFrontImage,omitempty"`
	CardBackImage  string      `json:"cardBackImage,omitempty"`
	Notes          string      `json:"notes,omitempty"`
	IsDeleted      bool        `json:"isDeleted"`
	CreatedAt      int64       `json:"createdAt"`
	UpdatedAt      int64       `json:"updatedAt"`
	IV             string      `json:"iv,omitempty"`
	Owner          string      `json:"owner,omitempty"`
	LastFour       string      `json:"lastFour,omitempty"` // 卡号后4位（明文，用于账单匹配）
}

// SyncRequest 同步请求
type SyncRequest struct {
	Cards      []Card `json:"cards"`
	LastSyncAt int64  `json:"lastSyncAt"`
	DeviceID   string `json:"deviceId"`
}

// SyncResponse 同步响应
type SyncResponse struct {
	Cards      []Card `json:"cards"`
	ServerTime int64  `json:"serverTime"`
	Success    bool   `json:"success"`
}

var db *sql.DB

func main() {
	// 初始化数据库
	initDB()
	defer db.Close()

	// 设置Gin
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// CORS配置 - 允许所有来源（因为是私有部署）
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Device-ID"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// API路由
	api := r.Group("/api/v1")
	{
		api.GET("/health", healthCheck)
		api.POST("/sync", syncCards)
		api.GET("/cards", getCards)
		api.POST("/cards", createCard)
		api.PUT("/cards/:id", updateCard)
		api.DELETE("/cards/:id", deleteCard)

		// 账单相关路由
		api.GET("/bills", handleGetBills)
		api.POST("/bills/fetch", handleFetchBills)
		api.GET("/email-config", handleGetEmailConfig)
		api.POST("/email-config", handleSaveEmailConfig)
		api.POST("/email-config/test", handleTestEmailConfig)
	}

	// 获取端口
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("信用卡管家服务启动在端口 %s", port)
	r.Run(":" + port)
}

func initDB() {
	var err error
	
	// 数据目录
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}
	os.MkdirAll(dataDir, 0755)
	
	dbPath := dataDir + "/cards.db"
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal("数据库连接失败:", err)
	}

	// 创建表
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS cards (
		id TEXT PRIMARY KEY,
		sync_id TEXT UNIQUE,
		name TEXT NOT NULL,
		bank TEXT NOT NULL,
		card_number TEXT,
		cvv TEXT,
		expiry_date TEXT,
		cardholder_name TEXT,
		credit_limit REAL,
		billing_day INTEGER,
		payment_due_day INTEGER,
		color TEXT,
		card_front_image TEXT,
		card_back_image TEXT,
		notes TEXT,
		iv TEXT,
		owner TEXT,
		last_four TEXT,
		is_deleted INTEGER DEFAULT 0,
		created_at INTEGER,
		updated_at INTEGER
	);
	CREATE INDEX IF NOT EXISTS idx_updated_at ON cards(updated_at);
	CREATE INDEX IF NOT EXISTS idx_sync_id ON cards(sync_id);
	`
	
	_, err = db.Exec(createTableSQL)
	if err != nil {
		log.Fatal("创建表失败:", err)
	}
	
	// 迁移：若旧数据库缺少 owner 列，自动添加（幂等操作）
	_, _ = db.Exec(`ALTER TABLE cards ADD COLUMN owner TEXT DEFAULT ''`)
	_, _ = db.Exec(`ALTER TABLE cards ADD COLUMN last_four TEXT DEFAULT ''`)

	// 初始化账单相关表（email_config、bill_statements）
	initBillsTables()

	log.Println("数据库初始化完成")
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"timestamp": time.Now().Unix(),
		"version":   "1.0.0",
	})
}

func syncCards(c *gin.Context) {
	var req SyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[syncCards] JSON解析失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	serverTime := time.Now().Unix()
	
	// 处理客户端发来的卡片
	for _, card := range req.Cards {
		if card.SyncID == "" {
			card.SyncID = uuid.New().String()
		}
		upsertCard(card)
	}

	// 获取服务器上更新的卡片
	serverCards := getCardsSince(req.LastSyncAt)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"cards":      serverCards,
			"serverTime": serverTime,
		},
		"timestamp": serverTime,
	})
}

func getCards(c *gin.Context) {
	rows, err := db.Query(`
		SELECT id, sync_id, name, bank, card_number, cvv, expiry_date, 
		       cardholder_name, credit_limit, billing_day, payment_due_day,
		       color, card_front_image, card_back_image, notes, iv, owner, last_four,
		       is_deleted, created_at, updated_at
		FROM cards WHERE is_deleted = 0
		ORDER BY updated_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	cards := []Card{}
	for rows.Next() {
		var card Card
		var isDeleted int
		err := rows.Scan(
			&card.ID, &card.SyncID, &card.Name, &card.Bank,
			&card.CardNumber, &card.CVV, &card.ExpiryDate,
			&card.CardholderName, &card.CreditLimit, &card.BillingDay,
			&card.PaymentDueDay, &card.Color, &card.CardFrontImage,
			&card.CardBackImage, &card.Notes, &card.IV, &card.Owner, &card.LastFour,
			&isDeleted, &card.CreatedAt, &card.UpdatedAt,
		)
		if err != nil {
			continue
		}
		card.IsDeleted = isDeleted == 1
		cards = append(cards, card)
	}

	c.JSON(http.StatusOK, gin.H{"cards": cards})
}

func createCard(c *gin.Context) {
	var card Card
	if err := c.ShouldBindJSON(&card); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	card.ID = json.Number(uuid.New().String())
	card.SyncID = uuid.New().String()
	card.CreatedAt = time.Now().Unix()
	card.UpdatedAt = card.CreatedAt

	err := insertCard(card)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, card)
}

func updateCard(c *gin.Context) {
	id := c.Param("id")
	
	var card Card
	if err := c.ShouldBindJSON(&card); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	card.ID = json.Number(id)
	card.UpdatedAt = time.Now().Unix()

	err := upsertCard(card)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, card)
}

func deleteCard(c *gin.Context) {
	id := c.Param("id")
	
	_, err := db.Exec(`
		UPDATE cards SET is_deleted = 1, updated_at = ? WHERE id = ? OR sync_id = ?
	`, time.Now().Unix(), id, id)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func insertCard(card Card) error {
	_, err := db.Exec(`
		INSERT INTO cards (
			id, sync_id, name, bank, card_number, cvv, expiry_date,
			cardholder_name, credit_limit, billing_day, payment_due_day,
			color, card_front_image, card_back_image, notes, iv, owner, last_four,
			is_deleted, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		card.ID, card.SyncID, card.Name, card.Bank, card.CardNumber,
		card.CVV, card.ExpiryDate, card.CardholderName, card.CreditLimit,
		card.BillingDay, card.PaymentDueDay, card.Color, card.CardFrontImage,
		card.CardBackImage, card.Notes, card.IV, card.Owner, card.LastFour, 0, card.CreatedAt, card.UpdatedAt,
	)
	return err
}

func upsertCard(card Card) error {
	_, err := db.Exec(`
		INSERT INTO cards (
			id, sync_id, name, bank, card_number, cvv, expiry_date,
			cardholder_name, credit_limit, billing_day, payment_due_day,
			color, card_front_image, card_back_image, notes, iv, owner, last_four,
			is_deleted, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(sync_id) DO UPDATE SET
			name = excluded.name,
			bank = excluded.bank,
			card_number = excluded.card_number,
			cvv = excluded.cvv,
			expiry_date = excluded.expiry_date,
			cardholder_name = excluded.cardholder_name,
			credit_limit = excluded.credit_limit,
			billing_day = excluded.billing_day,
			payment_due_day = excluded.payment_due_day,
			color = excluded.color,
			card_front_image = excluded.card_front_image,
			card_back_image = excluded.card_back_image,
			notes = excluded.notes,
			iv = excluded.iv,
			owner = excluded.owner,
				last_four = excluded.last_four,
			is_deleted = excluded.is_deleted,
			updated_at = excluded.updated_at
		WHERE excluded.updated_at > cards.updated_at
	`,
		card.ID, card.SyncID, card.Name, card.Bank, card.CardNumber,
		card.CVV, card.ExpiryDate, card.CardholderName, card.CreditLimit,
		card.BillingDay, card.PaymentDueDay, card.Color, card.CardFrontImage,
		card.CardBackImage, card.Notes, card.IV, card.Owner, card.LastFour,
		boolToInt(card.IsDeleted), card.CreatedAt, card.UpdatedAt,
	)
	return err
}

func getCardsSince(since int64) []Card {
	rows, err := db.Query(`
		SELECT id, sync_id, name, bank, card_number, cvv, expiry_date,
		       cardholder_name, credit_limit, billing_day, payment_due_day,
		       color, card_front_image, card_back_image, notes, iv, owner, last_four,
		       is_deleted, created_at, updated_at
		FROM cards WHERE updated_at > ?
		ORDER BY updated_at DESC
	`, since)
	if err != nil {
		return []Card{}
	}
	defer rows.Close()

	cards := []Card{}
	for rows.Next() {
		var card Card
		var isDeleted int
		err := rows.Scan(
			&card.ID, &card.SyncID, &card.Name, &card.Bank,
			&card.CardNumber, &card.CVV, &card.ExpiryDate,
			&card.CardholderName, &card.CreditLimit, &card.BillingDay,
			&card.PaymentDueDay, &card.Color, &card.CardFrontImage,
			&card.CardBackImage, &card.Notes, &card.IV, &card.Owner, &card.LastFour,
			&isDeleted, &card.CreatedAt, &card.UpdatedAt,
		)
		if err != nil {
			continue
		}
		card.IsDeleted = isDeleted == 1
		cards = append(cards, card)
	}
	return cards
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
