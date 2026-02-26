# 构建阶段
FROM golang:1.22-alpine AS builder

WORKDIR /app
ENV GOPROXY=https://goproxy.cn,direct

COPY go.mod ./
COPY . .
RUN go mod tidy && go mod download && go build -o server .

# 运行阶段
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Asia/Shanghai

WORKDIR /app
COPY --from=builder /app/server .

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 2006
CMD ["./server"]