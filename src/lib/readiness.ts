// Send-capacity + Twilio call-rate rules for the System Readiness tab.

// Twilio outbound calling limits (for voicemail drops):
//  • Default project rate is 1 call/second (CPS) = 60/min = 3,600/hour (raiseable by request).
//  • Each AMD voicemail drop = 1 outbound call, counting against CPS.
//  • Sustained high volume from ONE number risks carrier spam-labeling — the safe practice is
//    ~1 drop every 2 seconds (30/min) per number, and adding numbers to scale.
export const TWILIO_RULES = {
  hardMaxPerMin: 60,
  hardMaxPerHour: 3600,
  recommendedPerMin: 30, // 1 every 2s per number, reputation-safe
  recommendedPerHour: 1800,
  note: "Twilio default is 1 call/sec (60/min). Voicemail drops count as calls — throttle to ~30/min per number to protect caller-ID reputation, and add numbers to go faster.",
};

export type Readiness = {
  mailboxes: number;
  mailboxDailyCap: number;
  emailsPerDay: number;
  sendWindowHours: number;
  emailsPerHour: number;
  hourlyOptions: number[];
  voice: typeof TWILIO_RULES;
};

export function computeReadiness(mailboxes: number, mailboxDailyCap: number, sendWindowHours: number): Readiness {
  const emailsPerDay = mailboxes * mailboxDailyCap;
  const emailsPerHour = sendWindowHours > 0 ? Math.floor(emailsPerDay / sendWindowHours) : emailsPerDay;
  // throttle options: 50% / 75% / 100% of computed safe hourly rate
  const hourlyOptions = [Math.floor(emailsPerHour * 0.5), Math.floor(emailsPerHour * 0.75), emailsPerHour].filter((n) => n > 0);
  return { mailboxes, mailboxDailyCap, emailsPerDay, sendWindowHours, emailsPerHour, hourlyOptions, voice: TWILIO_RULES };
}
