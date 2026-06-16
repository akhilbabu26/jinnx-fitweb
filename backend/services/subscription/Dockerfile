FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY proto/ ./proto/
COPY services/subscription/ ./services/subscription/
WORKDIR /app/services/subscription
RUN go mod download && go build -o /bin/subscription-service ./cmd/

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /bin/subscription-service /bin/subscription-service
ENTRYPOINT ["/bin/subscription-service"]
