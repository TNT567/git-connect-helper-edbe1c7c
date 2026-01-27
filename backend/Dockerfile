# 使用 Golang 官方镜像进行编译
FROM golang:1.24-alpine AS builder
WORKDIR /app
# 复制所有后端源码
COPY . .
RUN go mod download
# 编译可执行文件
RUN go build -o whale-backend main.go

# 运行镜像
FROM alpine:latest
WORKDIR /root/
# 从编译阶段拷贝文件
COPY --from=builder /app/whale-backend .
COPY --from=builder /app/.env .
# 后端监听 8080 端口
EXPOSE 8080
CMD ["./whale-backend"]
