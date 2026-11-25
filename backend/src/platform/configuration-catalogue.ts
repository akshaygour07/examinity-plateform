/**
 * Approved platform configuration catalogue (D4).
 *
 * Each entry defines:
 *  - type         : data type used in the `value_type` column
 *  - settingName  : human-readable display name (stored in `setting_name`)
 *  - category     : logical grouping (stored in `category`)
 *  - description  : free-text description
 *  - defaultValue : initial value written during seed
 *  - isSensitive  : when true the API must not expose the raw value
 *  - isEditable   : when false the backend rejects update requests
 *  - validate     : runtime value validator called before every write
 *
 * Rules:
 *  - Backend/Platform Engineering own this catalogue. Ordinary administrators
 *    may change permitted setting values but cannot alter type, isSensitive,
 *    isEditable, or validation rules (D6).
 *  - Do NOT add real secrets here (e.g. API keys, SMTP passwords). Use a
 *    secrets manager and set isSensitive = true as a metadata marker only.
 */
export type ConfigurationDefinition = {
  type: string;
  settingName: string;
  category: string;
  description: string;
  defaultValue: unknown;
  isSensitive: boolean;
  isEditable: boolean;
  validate: (value: unknown) => boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const configurationCatalogue: Record<string, ConfigurationDefinition> = {
  default_locale: {
    type: "STRING",
    settingName: "Default Language",
    category: "Platform",
    description: "Default application locale for new users",
    defaultValue: "en-IN",
    isSensitive: false,
    isEditable: true,
    validate: (v) => typeof v === "string" && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(v),
  },
  default_timezone: {
    type: "STRING",
    settingName: "Default Timezone",
    category: "Platform",
    description: "Default application timezone for new users",
    defaultValue: "Asia/Kolkata",
    isSensitive: false,
    isEditable: true,
    validate: (v) => {
      if (typeof v !== "string") return false;
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    },
  },
  max_upload_size: {
    type: "NUMBER",
    settingName: "Maximum Upload Size (MiB)",
    category: "Platform",
    description: "Maximum media upload size in MiB",
    defaultValue: 10,
    isSensitive: false,
    isEditable: true,
    validate: (v) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 100,
  },
  supported_file_types: {
    type: "ARRAY",
    settingName: "Supported File Types",
    category: "Platform",
    description: "Allowlisted upload media MIME types",
    defaultValue: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    isSensitive: false,
    isEditable: true,
    validate: (v) =>
      Array.isArray(v) &&
      v.length > 0 &&
      v.every((item) => ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(String(item))),
  },
  pagination_default_page_size: {
    type: "NUMBER",
    settingName: "Default Page Size",
    category: "Platform",
    description: "Default list page size for paginated responses",
    defaultValue: 20,
    isSensitive: false,
    isEditable: true,
    validate: (v) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 100,
  },
  pagination_max_page_size: {
    type: "NUMBER",
    settingName: "Maximum Page Size",
    category: "Platform",
    description: "Maximum list page size allowed per paginated request",
    defaultValue: 100,
    isSensitive: false,
    isEditable: true,
    validate: (v) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 100,
  },
  session_timeout_policy: {
    type: "OBJECT",
    settingName: "Session Timeout",
    category: "Security",
    description: "Approved browser session timeout policy values in seconds",
    defaultValue: { absolute_seconds: 28800, inactivity_seconds: 7200 },
    isSensitive: false,
    isEditable: true,
    validate: (v) =>
      isRecord(v) &&
      Object.keys(v).every((k) => ["absolute_seconds", "inactivity_seconds"].includes(k)) &&
      Object.values(v).every((n) => Number.isInteger(n) && Number(n) > 0 && Number(n) <= 2592000),
  },
  maintenance_mode: {
    type: "BOOLEAN",
    settingName: "Maintenance Mode",
    category: "Platform",
    description: "Whether the application is currently in maintenance mode",
    defaultValue: false,
    isSensitive: false,
    isEditable: true,
    validate: (v) => typeof v === "boolean",
  },
  support_email: {
    type: "STRING",
    settingName: "Support Email",
    category: "Platform",
    description: "Public support contact email address",
    defaultValue: "support@example.invalid",
    isSensitive: false,
    isEditable: true,
    validate: (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
  default_notification_preferences: {
    type: "OBJECT",
    settingName: "Default Notification Preferences",
    category: "Notifications",
    description: "Default email notification preferences applied to new user profiles",
    defaultValue: { transactional_enabled: true, marketing_enabled: false },
    isSensitive: false,
    isEditable: true,
    validate: (v) =>
      isRecord(v) &&
      Object.keys(v).every((k) => ["transactional_enabled", "marketing_enabled"].includes(k)) &&
      Object.values(v).every((b) => typeof b === "boolean"),
  },
};

export const initialFeatureFlags: Array<{ key: string; name: string; description: string }> = [
  { key: "new_dashboard_enabled", name: "New Dashboard", description: "Enable the approved dashboard feature" },
  { key: "media_upload_enabled", name: "Media Upload", description: "Enable application media uploads" },
  { key: "public_media_enabled", name: "Public Media", description: "Allow explicitly approved public media assets" },
  { key: "advanced_profile_enabled", name: "Advanced Profile", description: "Enable advanced profile capabilities" },
];
