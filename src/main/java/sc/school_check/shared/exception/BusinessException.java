package sc.school_check.shared.exception;

public class BusinessException extends RuntimeException {

    private final Integer code;

    public BusinessException(String message) {
        this(400, message);
    }

    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code == null ? 400 : code;
    }

    public Integer getCode() {
        return code;
    }
}
