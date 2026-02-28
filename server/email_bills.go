package main

import (
	"crypto/tls"
	"database/sql"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
	"github.com/emersion/go-message/mail"
	"github.com/gin-gonic/gin"
)

// ─────────────────────────────────────────
// 数据结构
// ─────────────────────────────────────────

// EmailConfig 邮件拉取配置（存储在 SQLite email_config 表中）
type EmailConfig struct {
	ID       int64  `json:"id"`
	Email    string `json:"email"`    // 邮箱地址
	Password string `json:"password"` // 授权码（非登录密码）
	IMAPHost string `json:"imapHost"` // IMAP服务器，如 imap.qq.com:993
}

// BillStatement 账单记录
type BillStatement struct {
	ID              int64   `json:"id"`
	CardSyncID      string  `json:"cardSyncId"`      // 关联的信用卡 syncId
	EmailUID        uint32  `json:"emailUid"`        // IMAP邮件UID（去重用）
	Bank            string  `json:"bank"`            // 银行名称
	Amount          float64 `json:"amount"`          // 账单总额
	Currency        string  `json:"currency"`        // 货币（CNY/USD等）
	BillDate        string  `json:"billDate"`        // 账单日期 YYYY-MM-DD
	DueDate         string  `json:"dueDate"`         // 还款截止日期 YYYY-MM-DD
	MinPayment      float64 `json:"minPayment"`      // 最低还款额
	StatementType   string  `json:"statementType"`   // text/html/pdf
	MatchedBy       string  `json:"matchedBy"`       // full_card/last_four/name
	MatchConfidence string  `json:"matchConfidence"` // high/medium/low/ambiguous
	FetchedAt       int64   `json:"fetchedAt"`       // 拉取时间戳
	RawContent      string  `json:"rawContent,omitempty"` // 原始文本（可选返回）
}

// parsedBill 内部解析中间结构
type parsedBill struct {
	uid           uint32
	from          string
	subject       string
	body          string   // 文本内容
	statementType string

	// 从邮件中提取的账单字段
	fullCardNumber  string  // 完整卡号（若有）
	lastFourFromMsg string  // 尾号4位
	holderName      string  // 姓名
	amount          float64 // 账单金额
	currency        string
	minPayment      float64
	billDate        string
	dueDate         string
	bank            string
}

// ─────────────────────────────────────────
// 数据库初始化（由 main.go initDB 调用）
// ─────────────────────────────────────────

func initBillsTables() {
	sqls := []string{
		`CREATE TABLE IF NOT EXISTS email_config (
			id       INTEGER PRIMARY KEY AUTOINCREMENT,
			email    TEXT NOT NULL,
			password TEXT NOT NULL,
			imap_host TEXT NOT NULL DEFAULT 'imap.qq.com:993'
		);`,
		`CREATE TABLE IF NOT EXISTS bill_statements (
			id               INTEGER PRIMARY KEY AUTOINCREMENT,
			card_sync_id     TEXT NOT NULL,
			email_uid        INTEGER NOT NULL,
			bank             TEXT,
			amount           REAL,
			currency         TEXT DEFAULT 'CNY',
			bill_date        TEXT,
			due_date         TEXT,
			min_payment      REAL,
			statement_type   TEXT,
			raw_content      TEXT,
			matched_by       TEXT,
			match_confidence TEXT,
			fetched_at       INTEGER
		);`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_uid ON bill_statements(email_uid);`,
	}
	for _, s := range sqls {
		if _, err := db.Exec(s); err != nil {
			log.Printf("[bills] 建表警告: %v", err)
		}
	}
}

// ─────────────────────────────────────────
// IMAP 拉取
// ─────────────────────────────────────────

func fetchEmailsFromIMAP(cfg EmailConfig) ([]parsedBill, error) {
	tlsCfg := &tls.Config{ServerName: strings.Split(cfg.IMAPHost, ":")[0]}
	c, err := client.DialTLS(cfg.IMAPHost, tlsCfg)
	if err != nil {
		return nil, fmt.Errorf("IMAP连接失败: %w", err)
	}
	defer c.Logout()

	if err := c.Login(cfg.Email, cfg.Password); err != nil {
		return nil, fmt.Errorf("IMAP登录失败: %w", err)
	}

	mbox, err := c.Select("INBOX", false)
	if err != nil {
		return nil, fmt.Errorf("选择收件箱失败: %w", err)
	}

	if mbox.Messages == 0 {
		return nil, nil
	}

	// 只取最近 100 封（从最新开始）
	from := uint32(1)
	if mbox.Messages > 100 {
		from = mbox.Messages - 99
	}
	seqset := new(imap.SeqSet)
	seqset.AddRange(from, mbox.Messages)

	messages := make(chan *imap.Message, 10)
	done := make(chan error, 1)

	section := &imap.BodySectionName{}
	items := []imap.FetchItem{imap.FetchEnvelope, imap.FetchUid, section.FetchItem()}

	go func() {
		done <- c.Fetch(seqset, items, messages)
	}()

	var bills []parsedBill
	for msg := range messages {
		if msg == nil {
			continue
		}
		parsed := parseIMAPMessage(msg, section)
		if parsed != nil {
			bills = append(bills, *parsed)
		}
	}
	if err := <-done; err != nil {
		log.Printf("[bills] Fetch警告: %v", err)
	}
	return bills, nil
}

// ─────────────────────────────────────────
// 邮件解析
// ─────────────────────────────────────────

func parseIMAPMessage(msg *imap.Message, section *imap.BodySectionName) *parsedBill {
	if msg.Envelope == nil {
		return nil
	}

	pb := &parsedBill{
		uid:     msg.Uid,
		subject: msg.Envelope.Subject,
	}
	if len(msg.Envelope.From) > 0 {
		pb.from = msg.Envelope.From[0].Address()
	}

	// 读取正文
	r := msg.GetBody(section)
	if r == nil {
		return pb
	}

	mr, err := mail.CreateReader(r)
	if err != nil {
		log.Printf("[bills] 解析邮件(%d)失败: %v", msg.Uid, err)
		return pb
	}

	var textParts []string
	for {
		p, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			break
		}
		ct, _, _ := p.Header.ContentType()
		switch ct {
		case "text/plain":
			data, _ := io.ReadAll(p.Body)
			textParts = append(textParts, decodeBody(data))
			pb.statementType = "text"
		case "text/html":
			data, _ := io.ReadAll(p.Body)
			html := decodeBody(data)
			textParts = append(textParts, stripHTML(html))
			if pb.statementType == "" {
				pb.statementType = "html"
			}
		case "application/pdf":
			// 跳过PDF（不做OCR）
			log.Printf("[bills] 邮件(%d)包含PDF附件，跳过", msg.Uid)
			pb.statementType = "pdf"
		// 忽略图片
		case "image/jpeg", "image/png", "image/gif":
		}
	}

	pb.body = strings.Join(textParts, "\n")
	extractBillFields(pb)
	return pb
}

// decodeBody 处理 base64 / quoted-printable 编码（go-message库已处理，这里只做UTF-8安全截断）
func decodeBody(data []byte) string {
	// 尝试base64解码（如果整个body是base64）
	trimmed := strings.TrimSpace(string(data))
	if decoded, err := base64.StdEncoding.DecodeString(trimmed); err == nil && utf8.Valid(decoded) {
		return string(decoded)
	}
	return string(data)
}

// stripHTML 简单去除HTML标签
func stripHTML(html string) string {
	re := regexp.MustCompile(`<[^>]+>`)
	text := re.ReplaceAllString(html, " ")
	// 处理常见HTML实体
	text = strings.ReplaceAll(text, "&nbsp;", " ")
	text = strings.ReplaceAll(text, "&amp;", "&")
	text = strings.ReplaceAll(text, "&lt;", "<")
	text = strings.ReplaceAll(text, "&gt;", ">")
	text = strings.ReplaceAll(text, "&yen;", "¥")
	// 压缩多余空白
	spaceRe := regexp.MustCompile(`\s+`)
	return strings.TrimSpace(spaceRe.ReplaceAllString(text, " "))
}

// ─────────────────────────────────────────
// 账单字段正则提取
// ─────────────────────────────────────────

var (
	// 完整卡号：15-19位数字（可能有空格分隔）
	reFullCard = regexp.MustCompile(`\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{2,7})\b`)
	// 掩码卡号尾号：****1234 或 尾号1234 或 (1234) 等
	reLastFour = regexp.MustCompile(`(?:尾号|末四位|后四位|\*{2,}|x{2,})[\s\*x]*(\d{4})\b`)
	// 账单金额（支持人民币/CNY/¥/元等前后缀）
	reAmount = regexp.MustCompile(`(?:应还款额|账单金额|本期账单|本期应还|应还金额|总欠款|账单总额|还款总额)[^\d]*?([0-9,]+\.?\d{0,2})`)
	// 最低还款额
	reMinPay = regexp.MustCompile(`(?:最低还款|最低应还|最低还款额)[^\d]*?([0-9,]+\.?\d{0,2})`)
	// 账单日期
	reBillDate = regexp.MustCompile(`(?:账单日|出账日期?)[：:\s]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})`)
	// 还款截止日期
	reDueDate = regexp.MustCompile(`(?:还款日|还款截止|到期还款日|最后还款日)[：:\s]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})`)
	// 持卡人姓名
	reName = regexp.MustCompile(`(?:尊敬的客户|亲爱的|持卡人|您好)[，,\s]*([^\s，,。！]{2,8})(?:[，,\s]|$)`)
)

// 银行关键词 → 银行名称映射
var bankDomainMap = map[string]string{
	"cmbchina":   "招商银行",
	"icbc":       "工商银行",
	"ccb":        "建设银行",
	"abchina":    "农业银行",
	"bankcomm":   "交通银行",
	"spdb":       "浦发银行",
	"cib":        "兴业银行",
	"cmbc":       "民生银行",
	"cgbchina":   "广发银行",
	"pingan":     "平安银行",
	"citic":      "中信银行",
	"hxb":        "华夏银行",
	"boc":        "中国银行",
	"psbc":       "邮储银行",
}

var bankSubjectMap = map[string]string{
	"招商":   "招商银行",
	"工商":   "工商银行",
	"建设":   "建设银行",
	"农业":   "农业银行",
	"交通":   "交通银行",
	"浦发":   "浦发银行",
	"兴业":   "兴业银行",
	"民生":   "民生银行",
	"广发":   "广发银行",
	"平安":   "平安银行",
	"中信":   "中信银行",
	"华夏":   "华夏银行",
	"中国银行": "中国银行",
	"邮储":   "邮储银行",
}

func extractBillFields(pb *parsedBill) {
	text := pb.body
	subject := pb.subject

	// 识别银行（先从发件人域名，再从标题）
	pb.bank = detectBank(pb.from, subject)

	// 完整卡号
	if m := reFullCard.FindStringSubmatch(text); len(m) > 1 {
		raw := regexp.MustCompile(`[\s\-]`).ReplaceAllString(m[1], "")
		if len(raw) >= 15 {
			pb.fullCardNumber = raw
			pb.lastFourFromMsg = raw[len(raw)-4:]
		}
	}

	// 掩码卡号尾号（如果没找到完整卡号）
	if pb.lastFourFromMsg == "" {
		if m := reLastFour.FindStringSubmatch(text); len(m) > 1 {
			pb.lastFourFromMsg = m[1]
		}
		// 也在标题里找
		if pb.lastFourFromMsg == "" {
			if m := reLastFour.FindStringSubmatch(subject); len(m) > 1 {
				pb.lastFourFromMsg = m[1]
			}
		}
	}

	// 账单金额
	pb.currency = "CNY"
	if m := reAmount.FindStringSubmatch(text); len(m) > 1 {
		pb.amount = parseAmount(m[1])
	}

	// 最低还款
	if m := reMinPay.FindStringSubmatch(text); len(m) > 1 {
		pb.minPayment = parseAmount(m[1])
	}

	// 账单日期
	if m := reBillDate.FindStringSubmatch(text); len(m) > 1 {
		pb.billDate = normalizeDate(m[1])
	}

	// 还款截止日期
	if m := reDueDate.FindStringSubmatch(text); len(m) > 1 {
		pb.dueDate = normalizeDate(m[1])
	}

	// 持卡人姓名
	if m := reName.FindStringSubmatch(text); len(m) > 1 {
		name := strings.TrimSpace(m[1])
		// 过滤明显不是姓名的词
		excludes := []string{"您", "您已", "请", "温馨"}
		isExcluded := false
		for _, e := range excludes {
			if strings.Contains(name, e) {
				isExcluded = true
				break
			}
		}
		if !isExcluded {
			pb.holderName = name
		}
	}
}

func detectBank(from, subject string) string {
	fromLower := strings.ToLower(from)
	for domain, bank := range bankDomainMap {
		if strings.Contains(fromLower, domain) {
			return bank
		}
	}
	for keyword, bank := range bankSubjectMap {
		if strings.Contains(subject, keyword) {
			return bank
		}
	}
	return ""
}

func parseAmount(s string) float64 {
	s = strings.ReplaceAll(s, ",", "")
	var f float64
	fmt.Sscanf(s, "%f", &f)
	return f
}

func normalizeDate(s string) string {
	// 统一为 YYYY-MM-DD
	s = strings.ReplaceAll(s, "年", "-")
	s = strings.ReplaceAll(s, "月", "-")
	s = strings.ReplaceAll(s, "/", "-")
	// 补零
	parts := strings.Split(s, "-")
	if len(parts) == 3 {
		if len(parts[1]) == 1 {
			parts[1] = "0" + parts[1]
		}
		if len(parts[2]) == 1 {
			parts[2] = "0" + parts[2]
		}
		return strings.Join(parts, "-")
	}
	return s
}

// ─────────────────────────────────────────
// 卡片匹配
// ─────────────────────────────────────────

type matchResult struct {
	card       Card
	matchedBy  string
	confidence string
	found      bool
}

func matchBillToCard(pb parsedBill, cards []Card) matchResult {
	// 过滤已删除卡片
	var active []Card
	for _, c := range cards {
		if !c.IsDeleted {
			active = append(active, c)
		}
	}

	// 优先级1：完整卡号后4位精确匹配
	if pb.fullCardNumber != "" {
		last4 := pb.fullCardNumber[len(pb.fullCardNumber)-4:]
		for _, c := range active {
			if c.LastFour != "" && c.LastFour == last4 {
				return matchResult{card: c, matchedBy: "full_card", confidence: "high", found: true}
			}
		}
	}

	// 优先级2：掩码卡号尾号匹配
	if pb.lastFourFromMsg != "" {
		var matched []Card
		for _, c := range active {
			if c.LastFour != "" && c.LastFour == pb.lastFourFromMsg {
				matched = append(matched, c)
			}
		}
		if len(matched) == 1 {
			return matchResult{card: matched[0], matchedBy: "last_four", confidence: "medium", found: true}
		}
		if len(matched) > 1 {
			// 多张卡同尾号（理论上不应该，标为歧义）
			return matchResult{card: matched[0], matchedBy: "last_four", confidence: "ambiguous", found: true}
		}
	}

	// 优先级3：姓名匹配（低置信度）
	if pb.holderName != "" {
		var matched []Card
		for _, c := range active {
			if normalizeChineseName(c.CardholderName) == normalizeChineseName(pb.holderName) {
				matched = append(matched, c)
			}
		}
		if len(matched) == 1 {
			return matchResult{card: matched[0], matchedBy: "name", confidence: "low", found: true}
		}
		if len(matched) > 1 {
			return matchResult{card: matched[0], matchedBy: "name", confidence: "ambiguous", found: true}
		}
	}

	return matchResult{found: false}
}

func normalizeChineseName(s string) string {
	return strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(s), " ", ""))
}

// ─────────────────────────────────────────
// 存储账单到数据库
// ─────────────────────────────────────────

func saveBillStatement(bs BillStatement) error {
	// 已存在则跳过（email_uid唯一索引）
	_, err := db.Exec(`
		INSERT OR IGNORE INTO bill_statements 
		(card_sync_id, email_uid, bank, amount, currency, bill_date, due_date, 
		 min_payment, statement_type, raw_content, matched_by, match_confidence, fetched_at)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		bs.CardSyncID, bs.EmailUID, bs.Bank, bs.Amount, bs.Currency,
		bs.BillDate, bs.DueDate, bs.MinPayment, bs.StatementType,
		bs.RawContent, bs.MatchedBy, bs.MatchConfidence, bs.FetchedAt,
	)
	return err
}

// ─────────────────────────────────────────
// HTTP Handler：POST /api/v1/bills/fetch
// ─────────────────────────────────────────

func handleFetchBills(c *gin.Context) {
	// 从数据库读取邮件配置
	cfg, err := loadEmailConfig()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未配置邮箱，请先在设置中配置邮箱授权码"})
		return
	}

	// 拉取IMAP邮件
	bills, err := fetchEmailsFromIMAP(cfg)
	if err != nil {
		log.Printf("[bills] IMAP拉取失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 加载全部卡片用于匹配
	cards := getCardsAll()

	// 匹配并存储
	var saved, skipped int
	for _, pb := range bills {
		// 跳过PDF（无文字可解析）
		if pb.statementType == "pdf" && pb.body == "" {
			skipped++
			continue
		}

		mr := matchBillToCard(pb, cards)
		if !mr.found {
			skipped++
			continue
		}

		bs := BillStatement{
			CardSyncID:      mr.card.SyncID,
			EmailUID:        pb.uid,
			Bank:            pb.bank,
			Amount:          pb.amount,
			Currency:        pb.currency,
			BillDate:        pb.billDate,
			DueDate:         pb.dueDate,
			MinPayment:      pb.minPayment,
			StatementType:   pb.statementType,
			RawContent:      truncate(pb.body, 2000),
			MatchedBy:       mr.matchedBy,
			MatchConfidence: mr.confidence,
			FetchedAt:       time.Now().Unix(),
		}
		if err := saveBillStatement(bs); err != nil {
			log.Printf("[bills] 保存账单失败: %v", err)
		} else {
			saved++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total":   len(bills),
			"saved":   saved,
			"skipped": skipped,
		},
		"timestamp": time.Now().Unix(),
	})
}

// ─────────────────────────────────────────
// HTTP Handler：GET /api/v1/bills
// ─────────────────────────────────────────

func handleGetBills(c *gin.Context) {
	rows, err := db.Query(`
		SELECT id, card_sync_id, email_uid, bank, amount, currency,
		       bill_date, due_date, min_payment, statement_type,
		       matched_by, match_confidence, fetched_at
		FROM bill_statements
		ORDER BY fetched_at DESC
		LIMIT 200
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var bills []BillStatement
	for rows.Next() {
		var bs BillStatement
		err := rows.Scan(
			&bs.ID, &bs.CardSyncID, &bs.EmailUID, &bs.Bank, &bs.Amount,
			&bs.Currency, &bs.BillDate, &bs.DueDate, &bs.MinPayment,
			&bs.StatementType, &bs.MatchedBy, &bs.MatchConfidence, &bs.FetchedAt,
		)
		if err != nil {
			log.Printf("[bills] Scan失败: %v", err)
			continue
		}
		bills = append(bills, bs)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"data":      bills,
		"timestamp": time.Now().Unix(),
	})
}

// ─────────────────────────────────────────
// HTTP Handler：GET/POST /api/v1/email-config
// ─────────────────────────────────────────

func handleGetEmailConfig(c *gin.Context) {
	cfg, err := loadEmailConfig()
	if err != nil {
		// 未配置，返回空
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    nil,
			"timestamp": time.Now().Unix(),
		})
		return
	}
	// 不返回密码原文
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":       cfg.ID,
			"email":    cfg.Email,
			"imapHost": cfg.IMAPHost,
		},
		"timestamp": time.Now().Unix(),
	})
}

func handleSaveEmailConfig(c *gin.Context) {
	var cfg EmailConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if cfg.IMAPHost == "" {
		cfg.IMAPHost = "imap.qq.com:993"
	}

	// upsert（只保留一条配置）
	_, err := db.Exec(`
		INSERT INTO email_config (id, email, password, imap_host)
		VALUES (1, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			email = excluded.email,
			password = excluded.password,
			imap_host = excluded.imap_host
	`, cfg.Email, cfg.Password, cfg.IMAPHost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "timestamp": time.Now().Unix()})
}

// handleTestEmailConfig 测试IMAP连接是否正常
func handleTestEmailConfig(c *gin.Context) {
	var cfg EmailConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if cfg.IMAPHost == "" {
		cfg.IMAPHost = "imap.qq.com:993"
	}

	tlsCfg := &tls.Config{ServerName: strings.Split(cfg.IMAPHost, ":")[0]}
	imapClient, err := client.DialTLS(cfg.IMAPHost, tlsCfg)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "error": "连接IMAP服务器失败: " + err.Error()})
		return
	}
	defer imapClient.Logout()

	if err := imapClient.Login(cfg.Email, cfg.Password); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "error": "登录失败，请检查邮箱和授权码"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"message": "连接成功"}})
}

// ─────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────

func loadEmailConfig() (EmailConfig, error) {
	var cfg EmailConfig
	err := db.QueryRow(`SELECT id, email, password, imap_host FROM email_config WHERE id=1`).
		Scan(&cfg.ID, &cfg.Email, &cfg.Password, &cfg.IMAPHost)
	if err == sql.ErrNoRows {
		return cfg, fmt.Errorf("未配置")
	}
	return cfg, err
}

// getCardsAll 获取全部未删除卡片（不做分页，账单匹配用）
func getCardsAll() []Card {
	rows, err := db.Query(`
		SELECT id, sync_id, name, bank, card_number, cvv, expiry_date,
		       cardholder_name, credit_limit, billing_day, payment_due_day,
		       color, card_front_image, card_back_image, notes, iv, owner, last_four,
		       is_deleted, created_at, updated_at
		FROM cards WHERE is_deleted=0`)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var cards []Card
	for rows.Next() {
		var card Card
		var isDeleted int
		err := rows.Scan(
			&card.ID, &card.SyncID, &card.Name, &card.Bank,
			&card.CardNumber, &card.CVV, &card.ExpiryDate,
			&card.CardholderName, &card.CreditLimit, &card.BillingDay,
			&card.PaymentDueDay, &card.Color,
			&card.CardFrontImage, &card.CardBackImage,
			&card.Notes, &card.IV, &card.Owner, &card.LastFour,
			&isDeleted, &card.CreatedAt, &card.UpdatedAt,
		)
		if err != nil {
			continue
		}
		card.IsDeleted = isDeleted != 0
		cards = append(cards, card)
	}
	return cards
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "..."
}
