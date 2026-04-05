import Link from "next/link";
import {
  Stethoscope,
  Pill,
  Utensils,
  Thermometer,
  ShieldAlert,
  FileText,
  Camera,
  LayoutDashboard,
  Bell,
  Users,
  Smartphone,
  Heart,
  ArrowRight,
  PawPrint,
  Clock,
  Lock,
  Activity,
} from "lucide-react";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative px-6 py-20 sm:py-28 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
            <PawPrint className="w-4 h-4 text-emerald-300" />
            <span className="text-emerald-100 text-sm font-medium tracking-wide">Always Care Animal Clinic</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.1]">
            IPD Management
            <span className="block text-emerald-300 mt-1">for Stray Animals</span>
          </h1>
          <p className="mt-5 text-lg text-emerald-100/90 max-w-xl mx-auto leading-relaxed">
            A complete in-patient care system built for veterinary clinics treating stray and rescued animals.
            Track every medication, feeding, vital sign, and proof of care.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 bg-white text-emerald-800 font-semibold px-6 py-2.5 rounded-full hover:bg-emerald-50 transition-colors text-sm">
              Sign In <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      <section className="max-w-5xl mx-auto px-5 py-16 sm:py-20">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Everything you need to run IPD care</h2>
          <p className="mt-3 text-gray-500 max-w-lg mx-auto">From admission to discharge, every step is tracked, timed, and verified with proof.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Stethoscope />}
            title="Patient Management"
            color="emerald"
            items={[
              "Register patients with species, breed, weight, rescue info",
              "Clinical setup: assign ward, cage, diagnosis, attending doctor",
              "Transfer between wards, discharge, archive, and restore",
              "Cage conflict detection prevents double-booking",
            ]}
          />
          <FeatureCard
            icon={<Pill />}
            title="Medications"
            color="blue"
            items={[
              "Prescribe with drug, dose, route, frequency, scheduled times",
              "Track every dose: administered, skipped (with reason), or pending",
              "Undo administrations if recorded incorrectly",
              "Proof photos attached to each dose given",
            ]}
          />
          <FeatureCard
            icon={<Utensils />}
            title="Feeding & Diet"
            color="amber"
            items={[
              "Create diet plans with custom feeding schedules",
              "Log each meal: eaten, partial, refused, or skipped",
              "Proof photos for every feeding logged",
              "Edit diet mid-day without losing earlier logs",
            ]}
          />
          <FeatureCard
            icon={<Thermometer />}
            title="Vitals Monitoring"
            color="red"
            items={[
              "Record temperature, heart rate, respiratory rate, pain score",
              "SpO2, blood pressure, CRT, weight, mucous membrane color",
              "Automatic abnormal flags with visual alerts",
              "Vitals history with trend tracking",
            ]}
          />
          <FeatureCard
            icon={<ShieldAlert />}
            title="Isolation Ward"
            color="orange"
            items={[
              "Isolation protocols: disease, PPE, disinfectant, PCR status",
              "Scheduled disinfection intervals (Q4H, Q6H)",
              "Disinfection logging with overdue warnings",
              "Biosecurity notes and clearance tracking",
            ]}
          />
          <FeatureCard
            icon={<FileText />}
            title="Clinical Records"
            color="purple"
            items={[
              "Doctor round notes, observations, shift handovers",
              "Lab results: CBC, PCR, blood chemistry, with normal/abnormal flags",
              "Bath logs with due date tracking (every 5 days)",
              "IV fluid therapy with rate change history",
            ]}
          />
          <FeatureCard
            icon={<Camera />}
            title="Media & Proof"
            color="pink"
            items={[
              "Photo and video uploads stored in Google Drive",
              "Proof attachments on medications, feedings, baths, vitals",
              "Skip with reason when proof isn't available",
              "Media proxy for secure access without Drive sharing",
            ]}
          />
          <FeatureCard
            icon={<LayoutDashboard />}
            title="Management Dashboard"
            color="teal"
            items={[
              "Scrollable proof carousel: see care happening in real time",
              "Patient cards with medication and feeding progress",
              "Overdue alerts with minutes elapsed",
              "Today / History / Media tabs per patient",
            ]}
          />
          <FeatureCard
            icon={<Bell />}
            title="Alerts & Notifications"
            color="yellow"
            items={[
              "Web push notifications for overdue medications and feedings",
              "Cron-based alert monitoring every 15 minutes",
              "Critical vitals flagged automatically",
              "Bath due and disinfection overdue warnings",
            ]}
          />
          <FeatureCard
            icon={<Clock />}
            title="Schedule View"
            color="indigo"
            items={[
              "Daily medication schedule across all patients",
              "Feeding schedule with today's log status",
              "Bath due list with days-since tracking",
              "One-tap dose administration from schedule",
            ]}
          />
          <FeatureCard
            icon={<Users />}
            title="Role-Based Access"
            color="slate"
            items={[
              "Doctor: prescribe, modify clinical decisions",
              "Paravet & Attendant: record vitals, log feedings, administer meds",
              "Admin: manage staff accounts, cages, permanent deletions",
              "Management: read-only dashboard with proof verification",
            ]}
          />
          <FeatureCard
            icon={<Smartphone />}
            title="Mobile PWA"
            color="cyan"
            items={[
              "Install on any phone like a native app",
              "Mobile-first design optimized for clinic use",
              "Works on Android and iOS browsers",
              "Bottom navigation for quick access",
            ]}
          />
        </div>
      </section>

      {/* Activity Timeline callout */}
      <section className="bg-emerald-800 text-white">
        <div className="max-w-3xl mx-auto px-6 py-14 sm:py-16 text-center">
          <Activity className="w-8 h-8 text-emerald-300 mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Every action is logged</h2>
          <p className="mt-3 text-emerald-100/90 max-w-lg mx-auto leading-relaxed">
            Every medication given, every vital recorded, every feeding logged, every bath, every disinfection &mdash;
            it all appears in a unified activity timeline. Nothing falls through the cracks.
          </p>
        </div>
      </section>

      {/* Security & Trust */}
      <section className="max-w-3xl mx-auto px-6 py-14 sm:py-16">
        <div className="flex flex-col sm:flex-row items-start gap-4 p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Secure & Reliable</h3>
            <p className="mt-1 text-sm text-gray-500 leading-relaxed">
              JWT-based authentication with role-enforced access control. All data stored in Neon PostgreSQL with
              encrypted connections. Media stored in Google Drive with proxy access. Session management with
              automatic expiry and secure cookies.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Heart className="w-3.5 h-3.5 text-red-400" />
            <span>Built for Always Care Animal Clinic</span>
          </div>
          <Link href="/login" className="text-sm text-emerald-700 font-medium hover:underline">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}

const COLOR_MAP: Record<string, { bg: string; icon: string; border: string }> = {
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-100" },
  blue: { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-100" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600", border: "border-amber-100" },
  red: { bg: "bg-red-50", icon: "text-red-600", border: "border-red-100" },
  orange: { bg: "bg-orange-50", icon: "text-orange-600", border: "border-orange-100" },
  purple: { bg: "bg-purple-50", icon: "text-purple-600", border: "border-purple-100" },
  pink: { bg: "bg-pink-50", icon: "text-pink-600", border: "border-pink-100" },
  teal: { bg: "bg-teal-50", icon: "text-teal-600", border: "border-teal-100" },
  yellow: { bg: "bg-yellow-50", icon: "text-yellow-600", border: "border-yellow-100" },
  indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", border: "border-indigo-100" },
  slate: { bg: "bg-slate-50", icon: "text-slate-600", border: "border-slate-100" },
  cyan: { bg: "bg-cyan-50", icon: "text-cyan-600", border: "border-cyan-100" },
};

function FeatureCard({
  icon,
  title,
  color,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: string[];
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.emerald;

  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-5 transition-shadow hover:shadow-md`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm ${c.icon}`}>
          <span className="[&>svg]:w-[18px] [&>svg]:h-[18px]">{icon}</span>
        </div>
        <h3 className="font-semibold text-gray-900 text-[15px]">{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-[13px] text-gray-600 leading-snug flex items-start gap-2">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
