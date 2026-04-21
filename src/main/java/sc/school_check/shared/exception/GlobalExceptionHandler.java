package sc.school_check.shared.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import sc.school_check.shared.util.ResponseUtil;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseUtil<?> handleBusinessException(BusinessException ex, HttpServletRequest request) {
        log.warn("业务异常: path={}, code={}, message={}", request.getRequestURI(), ex.getCode(), ex.getMessage());
        return ResponseUtil.error(ex.getCode(), ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseUtil<?> handleMethodArgumentNotValidException(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(this::buildFieldErrorMessage)
                .orElse("请求参数校验失败");
        log.warn("参数校验异常: path={}, message={}", request.getRequestURI(), message);
        return ResponseUtil.error(400, message);
    }

    @ExceptionHandler(BindException.class)
    public ResponseUtil<?> handleBindException(BindException ex, HttpServletRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(this::buildFieldErrorMessage)
                .orElse("请求参数绑定失败");
        log.warn("参数绑定异常: path={}, message={}", request.getRequestURI(), message);
        return ResponseUtil.error(400, message);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseUtil<?> handleMissingServletRequestParameterException(MissingServletRequestParameterException ex,
                                                                         HttpServletRequest request) {
        String message = "缺少必要参数: " + ex.getParameterName();
        log.warn("缺少请求参数: path={}, parameter={}", request.getRequestURI(), ex.getParameterName());
        return ResponseUtil.error(400, message);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseUtil<?> handleIllegalArgumentException(IllegalArgumentException ex, HttpServletRequest request) {
        log.warn("非法参数异常: path={}, message={}", request.getRequestURI(), ex.getMessage());
        return ResponseUtil.error(400, defaultMessage(ex.getMessage(), "请求参数不合法"));
    }

    @ExceptionHandler({DuplicateKeyException.class, DataIntegrityViolationException.class})
    public ResponseUtil<?> handleDuplicateDataException(Exception ex, HttpServletRequest request) {
        log.warn("数据唯一约束异常: path={}, message={}", request.getRequestURI(), ex.getMessage());
        return ResponseUtil.error(400, "数据已存在，请检查后重试");
    }

    @ExceptionHandler(Exception.class)
    public ResponseUtil<?> handleException(Exception ex, HttpServletRequest request) {
        log.error("系统异常: path={}", request.getRequestURI(), ex);
        return ResponseUtil.error(500, "系统繁忙，请稍后重试");
    }

    private String buildFieldErrorMessage(FieldError error) {
        if (error == null) {
            return "请求参数校验失败";
        }
        return defaultMessage(error.getDefaultMessage(), error.getField() + " 参数不合法");
    }

    private String defaultMessage(String message, String fallback) {
        return message == null || message.trim().isEmpty() ? fallback : message.trim();
    }
}