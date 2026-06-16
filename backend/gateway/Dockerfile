FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY proto/ ./proto/
COPY gateway/ ./gateway/
WORKDIR /app/gateway
RUN go mod download && go build -o /bin/gateway ./cmd/

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /bin/gateway /bin/gateway
ENTRYPOINT ["/bin/gateway"]
