import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import styles from "./support.module.css";

export const metadata: Metadata = {
  title: "Support | Knct’d",
  description: "Get help with your Knct’d account, digital business card, follow-ups, and subscriptions.",
  alternates: { canonical: "/support" },
};

const questions = [
  {
    title: "I haven’t received my sign-in email.",
    answer: "Check that you entered the correct email address, then look in your inbox and spam folder. If you request another sign-in link, use the most recent email and open the link on the device where you use Knct’d.",
  },
  {
    title: "How do I share my business card?",
    answer: "Open My Card in the app and show your QR code to your new connection. They can scan it to open your public card and exchange contact details.",
  },
  {
    title: "My email follow-ups aren’t sending.",
    answer: "Check your connected email account, your follow-up settings, and your plan’s remaining allowance. If your email account needs to reconnect, complete that step and try again. Contact us if the issue continues.",
  },
  {
    title: "My paid plan isn’t showing up.",
    answer: "Open the upgrade or plan screen in Knct’d and choose Restore purchases. Make sure you’re signed into the store account you used for the original purchase.",
  },
  {
    title: "How do I manage or cancel my subscription?",
    answer: "For an iPhone purchase, open your iPhone’s Settings, tap your name, then Subscriptions, and select Knct’d. For a Google Play purchase, open Google Play and go to Payments & subscriptions, then Subscriptions. Deleting the app does not cancel a subscription.",
  },
];

export default function SupportPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Brand />
        <a href="/" className={styles.back}>Open Knct’d <span aria-hidden="true">↗</span></a>
      </header>
      <main>
        <section className={styles.hero} aria-labelledby="support-title">
          <p className="eyebrow">Knct’d support</p>
          <h1 id="support-title">A little help.<br />A better connection.</h1>
          <p>From your first digital card to your next follow-up, we’re here to help you keep things moving.</p>
        </section>
        <div className={styles.columns}>
          <section className={styles.contact} aria-labelledby="contact-title">
            <span className={styles.label}>Let’s sort it out</span>
            <h2 id="contact-title">Get in touch.</h2>
            <p>Have a question, found a bug, or need help with your account? Send us an email.</p>
            <a className={styles.email} href="mailto:noreply@getknctd.com">noreply@getknctd.com</a>
            <div className={styles.note}>
              <h3>Help us help you</h3>
              <p>Include your account email, device model, and a short description of what happened. A screenshot can help, too.</p>
              <p>Please don’t send passwords, sign-in links, or payment card details.</p>
            </div>
          </section>
          <section className={styles.faq} aria-labelledby="faq-title">
            <p className="eyebrow">A good place to start</p>
            <h2 id="faq-title">Common questions</h2>
            {questions.map(({ title, answer }) => (
              <details key={title}>
                <summary>{title}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </section>
        </div>
      </main>
      <footer className={styles.footer}>
        <span>Knct’d · Make the connection. Keep it going.</span>
        <a href="#support-title">Back to top ↑</a>
      </footer>
    </div>
  );
}
