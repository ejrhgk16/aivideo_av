let refreshToken: string | null = null;

export const readRefreshToken = async () => refreshToken;
export const writeRefreshToken = async (token: string) => { refreshToken = token; };
export const removeRefreshToken = async () => { refreshToken = null; };
