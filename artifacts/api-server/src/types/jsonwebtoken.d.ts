declare module "jsonwebtoken" {
  export function sign(payload: object, secret: string, options?: { expiresIn?: string | number }): string;
  export function verify(token: string, secret: string): object | string;
}
