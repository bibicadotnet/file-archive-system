// functions/auth.js - Xử lý xác thực cho trang index.html

// Cấu hình xác thực trực tiếp trong code
const AUTH_CONFIG = {
  enabled: true, // true: bật xác thực, false: tắt xác thực
  username: "YOUR_USERNAME", // thay đổi username tại đây
  password: "YOUR_PASSWORD" // thay đổi password tại đây
};

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Chỉ áp dụng xác thực cho trang chủ, index.html và admin
  if (path === "/" || path === "/index.html" || path === "/admin") {
    // Kiểm tra xem có bật xác thực không
    if (AUTH_CONFIG.enabled) {
      // Lấy header Authorization
      const authHeader = request.headers.get("Authorization");
      
      // Kiểm tra xác thực
      if (!isAuthenticated(authHeader)) {
        return new Response("Unauthorized", {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="Admin Access"',
            "Cache-Control": "no-store"
          }
        });
      }
    }
  }
  
  // Cho phép truy cập nếu:
  // 1. Không phải trang cần xác thực
  // 2. Xác thực thành công
  // 3. Xác thực không được bật
  return next();
}

function isAuthenticated(authHeader) {
  // Nếu không có header Authorization
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }
  
  try {
    // Giải mã Base64
    const base64 = authHeader.split(" ")[1];
    const decoded = atob(base64);
    
    // Kiểm tra thông tin đăng nhập
    const [user, pass] = decoded.split(":");
    return user === AUTH_CONFIG.username && pass === AUTH_CONFIG.password;
  } catch (error) {
    console.error("Auth error:", error);
    return false;
  }
} 
