package sc.school_check.shared.util;

import lombok.Data;

@Data
public class ResponseUtil<T> {
    private Integer code;
    private String msg;
    private T data;

    public static <T> ResponseUtil<T> success() {
        return new ResponseUtil<>(200, "操作成功", null);
    }

    public static <T> ResponseUtil<T> success(T data) {
        return new ResponseUtil<>(200, "操作成功", data);
    }

    public static <T> ResponseUtil<T> error(Integer code, String msg) {
        return new ResponseUtil<>(code, msg, null);
    }

    private ResponseUtil(Integer code, String msg, T data) {
        this.code = code;
        this.msg = msg;
        this.data = data;
    }
}
