export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Sign in to continue.");
    this.name = "UnauthorizedError";
  }
}
