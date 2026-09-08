import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'nextjs-stripe-referrals',
  description:
    'A drop-in referral program for Next.js, Prisma and Stripe: referrals who pay discount the referrer, and stop discounting the moment they stop paying.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-4xl px-5 py-10">{children}</div>
      </body>
    </html>
  );
}
