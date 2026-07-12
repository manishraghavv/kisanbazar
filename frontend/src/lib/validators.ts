import { z } from "zod";

// ─── Login ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  password: z
    .string()
    .min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ─── Register ─────────────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name is too long"),
    phoneNumber: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
    email: z
      .string()
      .email("Enter a valid email address")
      .optional()
      .or(z.literal("")),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters"),
    confirmPassword: z
      .string()
      .min(6, "Please confirm your password"),
    role: z.enum(["FARMER", "VENDOR", "ADMIN", "DELIVERY"]),
    referralCode: z.string().optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

// ─── OTP Verify ───────────────────────────────────────────────────────────────

export const otpSchema = z.object({
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only digits"),
});

export type OtpFormValues = z.infer<typeof otpSchema>;

// ─── Forgot Password ──────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

// ─── Reset Password ───────────────────────────────────────────────────────────

export const resetPasswordSchema = z
  .object({
    otp: z
      .string()
      .length(6, "OTP must be 6 digits")
      .regex(/^\d{6}$/, "OTP must contain only digits"),
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters"),
    confirmPassword: z
      .string()
      .min(6, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
