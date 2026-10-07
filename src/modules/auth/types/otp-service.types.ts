export type VerifyPurpose = 'registration' | 'email-change' | 'account-deletion'; 

export type TOtpData = {
	code: string;
	attempts: number;
	payload?: OtpPayload;
};

export type OtpPayload = { newEmail?: string; reason?: string };
