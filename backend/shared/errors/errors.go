package errors

import (
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// HTTP Constants
const (
	SUCCESS             = 200
	CREATED             = 201
	BADREQUEST          = 400
	UNAUTHORIZED        = 401
	FORBIDDEN           = 403
	NOTFOUND            = 404
	CONFLICT            = 409
	INTERNALSERVERERROR = 500
)

type AppError struct {
	Code      int    `json:"-"`
	Message   string `json:"message"`
	ErrorCode string `json:"code"`
	Details   any    `json:"details,omitempty"`
	Err       error  `json:"-"`
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return e.Message
}

func New(code int, errorCode, message string, err error) *AppError {
	return &AppError{
		Code:      code,
		Message:   message,
		ErrorCode: errorCode,
		Err:       err,
	}
}

func BadRequest(message string, err error) *AppError {
	return New(BADREQUEST, "BAD_REQUEST", message, err)
}

func Unauthorized(message string, err error) *AppError {
	return New(UNAUTHORIZED, "UNAUTHORIZED", message, err)
}

func Forbidden(message string, err error) *AppError {
	return New(FORBIDDEN, "FORBIDDEN", message, err)
}

func NotFound(message string, err error) *AppError {
	return New(NOTFOUND, "NOT_FOUND", message, err)
}

func Conflict(message string, err error) *AppError {
	return New(CONFLICT, "CONFLICT", message, err)
}

func Internal(message string, err error) *AppError {
	return New(INTERNALSERVERERROR, "INTERNAL_ERROR", message, err)
}

// ToGRPCError converts standard app errors to gRPC errors.
func ToGRPCError(err error) error {
	if err == nil {
		return nil
	}
	var appErr *AppError
	if errors.As(err, &appErr) {
		switch appErr.Code {
		case BADREQUEST:
			return status.Error(codes.InvalidArgument, appErr.Message)
		case UNAUTHORIZED:
			return status.Error(codes.Unauthenticated, appErr.Message)
		case FORBIDDEN:
			return status.Error(codes.PermissionDenied, appErr.Message)
		case NOTFOUND:
			return status.Error(codes.NotFound, appErr.Message)
		case CONFLICT:
			return status.Error(codes.AlreadyExists, appErr.Message)
		default:
			return status.Error(codes.Internal, appErr.Message)
		}
	}
	return status.Error(codes.Internal, err.Error())
}

// FromGRPCError converts gRPC errors back to HTTP statuses & custom app errors for the Gateway.
func FromGRPCError(err error) *AppError {
	if err == nil {
		return nil
	}
	st, ok := status.FromError(err)
	if !ok {
		return Internal(err.Error(), err)
	}

	switch st.Code() {
	case codes.InvalidArgument:
		return BadRequest(st.Message(), err)
	case codes.Unauthenticated:
		return Unauthorized(st.Message(), err)
	case codes.PermissionDenied:
		return Forbidden(st.Message(), err)
	case codes.NotFound:
		return NotFound(st.Message(), err)
	case codes.AlreadyExists:
		return Conflict(st.Message(), err)
	default:
		return Internal(st.Message(), err)
	}
}
