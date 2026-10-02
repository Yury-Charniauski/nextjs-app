export type LoginAttemptData = {
  userId: string;
  ip?: string;
	userAgent?: string;
};

export type LoginAttemptRes = LoginAttemptData & {
  attempts: number;
  code: string;
};
