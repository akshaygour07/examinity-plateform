/**
 * Provider-independent application boundary for future business-level verification.
 *
 * ## Purpose
 * This interface reserves the shape of a verification capability that future
 * Commerce, Transaction, or Mobile-Verification modules will implement.  It
 * intentionally does NOT implement authentication OTP — that responsibility
 * belongs exclusively to Auth0 (see spec sections 17 and 21).
 *
 * ## Module 1 status
 * Only the interface boundary is defined here.  No implementation class, NestJS
 * provider, or database table is created in Module 1.  Future modules must:
 *   1. Implement this interface with a concrete provider adapter class.
 *   2. Register that class as a NestJS provider using the `VERIFICATION_SERVICE`
 *      injection token (to be defined when the first implementation lands).
 *   3. Write their own OTP storage, rate-limiting, and provider integration.
 *
 * ## Out of scope for Module 1
 * - Transaction OTP
 * - Payment OTP
 * - SMS / WhatsApp OTP delivery
 * - Mobile-number verification
 * - OTP database tables (`otp_codes`, `otp_attempts`, `otp_sessions`)
 * - Redis-based OTP storage
 *
 * @see docs/admin-api-contract.md — Section: Business Verification Boundary
 */
export interface VerificationService {
  /**
   * Initiates a new verification challenge and returns a reference ID and
   * expiry timestamp.  The delivery channel (email, SMS, WhatsApp, etc.) is
   * determined by the concrete implementation.
   */
  requestVerification(input: {
    /** Internal Examinity user ID for whom the challenge is created. */
    subjectId: string;
    /** Application-defined purpose code, e.g. `mobile_verification`. */
    purpose: string;
    /** Delivery destination (e.g. E.164 phone number or email address). */
    destination: string;
  }): Promise<{ challengeId: string; expiresAt: Date }>;

  /**
   * Validates a one-time code against an open challenge.
   * Returns `{ verified: true }` on success; the challenge is consumed and
   * cannot be reused after a successful or exhausted attempt.
   */
  verifyCode(input: { challengeId: string; code: string }): Promise<{ verified: boolean }>;

  /** Marks a challenge as expired before its natural TTL, e.g. on user cancellation. */
  expireVerification(challengeId: string): Promise<void>;

  /** Cancels an open challenge, preventing further verification attempts against it. */
  cancelVerification(challengeId: string): Promise<void>;
}
