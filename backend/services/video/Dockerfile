FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY proto/ ./proto/
COPY services/video/ ./services/video/
WORKDIR /app/services/video
RUN go mod download && go build -o /bin/video-service ./cmd/

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /bin/video-service /bin/video-service
ENTRYPOINT ["/bin/video-service"]
