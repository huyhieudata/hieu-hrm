/** Luật mật khẩu nhẹ: ≥ 8 ký tự, có cả chữ và số. Trả về câu lỗi tiếng Việt hoặc null. */
export const passwordProblem = (password: string): string | null => {
  if (password.length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return "Mật khẩu cần có cả chữ và số.";
  return null;
};

/** Không để nút kẹt vô hạn: quá `ms` thì báo lỗi rõ ràng. */
export const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(id);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(id);
        reject(error);
      },
    );
  });
