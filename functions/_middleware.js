// functions/_middleware.js - Đảm bảo xác thực được gọi trước các functions khác

import { onRequest as authHandler } from './auth';

export const onRequest = [authHandler]; 