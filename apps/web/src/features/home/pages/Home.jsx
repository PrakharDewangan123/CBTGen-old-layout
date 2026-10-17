import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Hero from "../components/Hero"
import Features from "../components/Features"

const topics = [
  "Paper Import Help",
  "Test Configuration",
  "Report a Problem",
  "Usage & Packs",
]

export default function Home() {
  const [topic, setTopic] = useState(topics[0])
  const navigate = useNavigate()

  function goContact() {
    navigate('/')
    window.setTimeout(() => {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  return (
    <>
      <Hero />
      <Features />

      {/* Home-page contact section: UI preview only until delivery is configured. */}
      <section id="contact" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2662ff]">CBTGen Support</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1020] sm:text-4xl">
              Need a hand with your next test?
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-600">
              Find help with importing question papers, configuring a test, reporting a problem,
              or understanding usage and packs.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                ["Paper Import Help", "XML packages and missing assets"],
                ["Test Configuration", "Sections, timing and marking"],
                ["Report a Problem", "Errors or unexpected behaviour"],
                ["Usage & Packs", "Demo allowance and plan questions"],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="font-semibold text-[#0b1020]">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="font-semibold text-[#0b1020]">Prefer email?</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                The official support email address will be published here once configured.
                No unverified contact address is shown.
              </p>
            </div>
          </div>

          <form
            onSubmit={(event) => event.preventDefault()}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <h3 className="text-xl font-bold text-[#0b1020]">Contact CBTGen</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Form preview only — message delivery is not connected yet.
            </p>
            <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="contact-name">Your name</label>
            <input id="contact-name" placeholder="Enter your name" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" />
            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="contact-email">Email address</label>
            <input id="contact-email" type="email" placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" />
            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="contact-topic">Topic</label>
            <select id="contact-topic" value={topic} onChange={(event) => setTopic(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {topics.map((item) => <option key={item}>{item}</option>)}
            </select>
            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="contact-message">Message</label>
            <textarea id="contact-message" rows={4} placeholder="Describe how we can help…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" />
            <button type="button" disabled className="mt-5 w-full cursor-not-allowed rounded-xl bg-[#2662ff]/50 px-5 py-3 font-semibold text-white" title="Contact delivery is not configured">
              Send message — coming soon
            </button>
          </form>
        </div>
      </section>

      <footer className="bg-[#080d1d] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <a href="/" className="inline-flex items-center gap-3">
                <img src="/cbtgen-monogram-tab.png" alt="" className="h-10 w-10 object-contain" />
                <span className="text-lg font-bold">CBT<span className="text-[#2662ff]">Gen</span></span>
              </a>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
                Your papers. Your practice. Your progress.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Explore</h3>
              <div className="mt-3 flex flex-col items-start gap-2 text-sm text-slate-300">
                <a className="hover:text-white" href="/">Home</a>
                <a className="hover:text-white" href="/plans">Plans</a>
                <a className="hover:text-white" href="/question-papers">My Library</a>
                <a className="hover:text-white" href="/account">Account</a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold">Help & Information</h3>
              <div className="mt-3 flex flex-col items-start gap-2 text-sm text-slate-300">
                <a className="hover:text-white" href="/faq">FAQ</a>
                <button type="button" onClick={goContact} className="text-left hover:text-white">Contact</button>
                <span className="text-slate-500">Privacy Policy — coming soon</span>
                <span className="text-slate-500">Terms of Service — coming soon</span>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-white/10 pt-5 text-xs text-slate-500">
            © 2026 CBTGen. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  )
}
