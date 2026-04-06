"use client";

import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

interface WelcomeCardProps {
  voornaam?: string;
}

export function WelcomeCard({ voornaam }: WelcomeCardProps) {
  const greeting = voornaam ? `Hallo ${voornaam}` : "Welkom";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="px-4 pt-6 pb-2"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[#2799D7] flex items-center justify-center shrink-0 mt-0.5">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-heading font-semibold text-[#163247]">
            {greeting}!
          </h2>
          <p className="text-sm text-[#5F7382] mt-1 leading-relaxed">
            Ik ben je Fleet Companion. Stel me een vraag over je wagen,
            contract, documenten of laadkosten.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
