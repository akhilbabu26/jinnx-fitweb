FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY proto/ ./proto/
COPY services/chat/ ./services/chat/
WORKDIR /app/services/chat
RUN go mod download && go build -o /bin/chat-service ./cmd/

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /bin/chat-service /bin/chat-service
ENTRYPOINT ["/bin/chat-service"]
