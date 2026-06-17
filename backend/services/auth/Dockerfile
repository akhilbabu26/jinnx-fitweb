FROM golang:1.26-alpine AS builder
WORKDIR /app

# Copy shared modules so replace directives resolve
COPY shared/ ./shared/
COPY proto/ ./proto/

# Copy this service
COPY services/auth/ ./services/auth/

WORKDIR /app/services/auth
RUN go mod tidy && go build -o /bin/auth-service ./cmd/

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /bin/auth-service /bin/auth-service
ENTRYPOINT ["/bin/auth-service"]
