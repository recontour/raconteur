"use client";

import React from "react";
import { BottomCTA } from "./BottomCTA";

const TERMS_SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an account and using Raconteur, you confirm that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree, you may not use the service.",
  },
  {
    title: "2. Use of the Service",
    body: "Raconteur grants you a limited, non-exclusive, non-transferable licence to use the app for personal, non-commercial purposes. You agree not to misuse, reverse-engineer, or attempt to compromise the security of the platform.",
  },
  {
    title: "3. User Content",
    body: "You retain ownership of all content you upload or create within Raconteur. By posting content, you grant us a worldwide, royalty-free licence to use, display, and distribute your content solely to operate the service.",
  },
  {
    title: "4. Privacy",
    body: "We collect only the information necessary to provide the service. Phone numbers are used exclusively for authentication. We do not sell your personal data to third parties. Please review our Privacy Policy for full details.",
  },
  {
    title: "5. Account Security",
    body: "You are responsible for maintaining the security of your account and all activity that occurs under it. Notify us immediately at security@raconteur.app if you suspect unauthorised access.",
  },
  {
    title: "6. Prohibited Conduct",
    body: "You agree not to use Raconteur to transmit illegal, harmful, abusive, or offensive content; to impersonate another person; or to interfere with the service's proper functioning.",
  },
  {
    title: "7. Termination",
    body: "We reserve the right to suspend or terminate your account at any time for violation of these terms, with or without notice. You may delete your account at any time from the settings menu.",
  },
  {
    title: "8. Changes to Terms",
    body: "We may update these Terms from time to time. Continued use of Raconteur after changes constitutes your acceptance. We will notify you of material changes via in-app notification.",
  },
  {
    title: "9. Limitation of Liability",
    body: "Raconteur is provided 'as is' without warranties of any kind. To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the service.",
  },
  {
    title: "10. Governing Law",
    body: "These Terms are governed by the laws of the jurisdiction in which Raconteur operates. Any disputes shall be resolved through binding arbitration, except where prohibited by law.",
  },
];

interface Props {
  onAgree: () => void;
  onBack: () => void;
}

export function StepTerms({ onAgree, onBack }: Props) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-none px-6 pt-8 pb-4">
        <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
          Terms &amp; Conditions
        </h2>
        <p className="text-gray-500 text-base mt-1">
          Please read and accept before continuing.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
        {TERMS_SECTIONS.map((s) => (
          <div key={s.title}>
            <h3 className="font-semibold text-[#1d1d1f] mb-1">{s.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <BottomCTA offset={0}>
        <div className="space-y-3">
          <button
            onClick={onAgree}
            className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg active:scale-[0.98] shadow-sm select-none transition-all"
          >
            I Agree
          </button>
          <button
            onClick={onBack}
            className="w-full py-4 border border-gray-300 rounded-xl text-black font-medium text-lg active:scale-[0.98] transition-all"
          >
            Back
          </button>
        </div>
      </BottomCTA>
    </div>
  );
}
