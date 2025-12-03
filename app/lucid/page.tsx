// app/lucid/page.tsx

import TopNav from "@/components/TopNav";

export default function LucidHubPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
      >
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-600/40 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-60px] h-72 w-72 rounded-full bg-sky-500/30 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-10">
        <TopNav />

        {/* Header */}
        <section className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-50">
            Lucid Hub
          </h1>
          <p className="text-slate-300">
            This is your space for learning how lucid dreaming works and how to increase the chances
            of becoming aware inside your dreams. Everything here stays grounded, practical, and
            focused on what actually helps people build lucidity over time.
          </p>
          <p className="text-slate-400">
            Lucid dreaming is a skill. It comes from a mix of intention, awareness, and consistent
            practice. The tools on this page are designed to support that process without trying to
            force results or overwhelm you with theory.
          </p>
        </section>

        {/* What is lucid dreaming */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-lg shadow-black/40">
          <h2 className="text-xl font-semibold text-slate-50">
            What is lucid dreaming
          </h2>
          <p className="text-slate-300">
            Lucid dreaming happens when you realise you are dreaming while the dream is still
            happening. In this state, awareness is active but the dream continues, allowing you to
            explore the dream environment with clarity and intention. You can influence the dream or even control it.
          </p>
          <p className="text-slate-400">
            Most lucid dreams occur during REM sleep. The likelihood increases when dream recall is
            strong, you go to sleep with a clear intention, your mind remains slightly aware as your
            body falls asleep, and you wake up and go back to sleep during REM rich periods.
          </p>
          <p className="text-slate-400">
            This hub brings together the techniques and audio tools that support those conditions.
          </p>
        </section>

        {/* Core techniques */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-50">
            Core techniques
          </h2>

          {/* Dream journaling */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-lg shadow-black/40">
            <h3 className="text-lg font-semibold text-slate-50">
              1. Dream journaling
            </h3>
            <p className="text-slate-300">
              Recording dreams immediately strengthens recall and increases the chance of recognising
              dream patterns. It trains your brain to pay attention to dreams in general, which is the
              foundation for lucidity.
            </p>
            <p className="text-slate-400">
              Onyva is built around this habit. The more you log, the more your dream world opens up.
            </p>
          </div>

          {/* Reality checks */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-lg shadow-black/40">
            <h3 className="text-lg font-semibold text-slate-50">
              2. Reality checks
            </h3>
            <p className="text-slate-300">
              Reality checks help you question whether you are awake or dreaming throughout the day.
              Over time this habit carries over into dreams, where the same question can trigger lucidity.
            </p>
            <p className="text-slate-400">
              Common checks include looking at your hands, trying to push a finger through your palm,
              reading text and looking away then reading it again, or simply asking yourself
              with genuine curiosity, am I dreaming right now.
            </p>
            <p className="text-slate-400">
              The goal is not to memorise a trick but to cultivate reflective awareness.
            </p>
          </div>

          {/* Intention setting */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-lg shadow-black/40">
            <h3 className="text-lg font-semibold text-slate-50">
              3. Intention setting
            </h3>
            <p className="text-slate-300">
              Before sleep, set a simple intention:
            </p>
            <p className="text-indigo-300 italic">
              Next time I am dreaming, I will recognise that I am dreaming.
            </p>
            <p className="text-slate-400">
              This statement keeps the idea of lucidity active in your mind. You do not need to repeat
              it endlessly. Hold it lightly, as if placing a reminder in the background of your awareness.
            </p>
            <p className="text-slate-400">
              This is the basis of the MILD technique, one of the most reliable lucid dreaming methods.
            </p>
          </div>

          {/* WBTB */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-lg shadow-black/40">
            <h3 className="text-lg font-semibold text-slate-50">
              4. Wake Back To Bed
            </h3>
            <p className="text-slate-300">
              If you naturally wake up after four to six hours of sleep, you enter a window where REM
              sleep becomes longer and more vivid. This is an ideal time for lucidity.
            </p>
            <p className="text-slate-400">
              A simple routine is to wake, stay up for a few minutes, revisit a recent dream or your
              intention, then use the Wake Back To Bed track as you drift back to sleep.
            </p>
            <p className="text-slate-400">
              Many people find this timing significantly increases their chances of lucid dreams.
            </p>
          </div>
        </section>

        {/* Binaural beats explanation */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-lg shadow-black/40">
          <h2 className="text-xl font-semibold text-slate-50">
            What are binaural beats
          </h2>
          <p className="text-slate-300">
            Binaural beats occur when each ear hears a slightly different pure tone, such as 200 Hz in
            the left ear and 204 Hz in the right ear. Your brain perceives the difference between them
            as a slow pulse, in this case 4 Hz, which sits in the theta range linked with relaxation
            and early sleep.
          </p>
          <p className="text-slate-400">
            This is not magic and not mind control. It is simply a way to create a consistent, gentle
            state that can support relaxation and intention setting.
          </p>
          <p className="text-slate-400 font-medium">
            Binaural beats require headphones. On speakers, the effect disappears.
          </p>
        </section>

        {/* Audio tools */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-50">
            Audio tools for lucid dreaming
          </h2>
          <p className="text-slate-300">
            The tracks below are designed to support your lucid dreaming practice. They do not force
            lucidity. They help create conditions where lucid dreams are more likely.
          </p>

          {/* Fall asleep track card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg shadow-black/40">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-slate-50">
                Fall asleep track
              </h3>
              <p className="text-sm text-slate-400">
                About 20 minutes • Ambient pad, ocean texture and gentle theta range binaural beats • Includes a short voice introduction
              </p>
            </div>
            <p className="text-slate-300">
              Use this track at bedtime. Play it at a low volume. The tones should feel soft and barely
              noticeable. It is ideal when you want a smooth transition into sleep while keeping a clear
              intention for lucidity active in the background.
            </p>
            <p className="text-slate-400 font-medium">
              For proper binaural effect, use headphones and keep the volume comfortable and low.
            </p>
            <div className="space-y-3">
              <audio
                controls
                className="w-full mt-2 rounded-lg bg-slate-800"
              >
                <source src="/audio/fall-asleep.mp3" type="audio/mpeg" />
                Your browser does not support audio playback.
              </audio>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/audio/fall-asleep.mp3"
                  download
                  className="inline-flex items-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
                >
                  Download MP3
                </a>
              </div>
            </div>
          </div>

          {/* WBTB track card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg shadow-black/40">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-slate-50">
                Wake Back To Bed track
              </h3>
              <p className="text-sm text-slate-400">
                Around 20 minutes • Designed for the second half of the night • Focused voice prompt with the same gentle binaural bed
              </p>
            </div>
            <p className="text-slate-300">
              Use this track if you wake after several hours of sleep. Stay awake for a short time,
              revisit your intention or a recent dream, then play the track as you lie back down. This
              targets REM rich periods where lucid dreams are more likely.
            </p>
            <p className="text-slate-400 font-medium">
              Headphones are required. Keep the volume low and let the track sit in the background of your awareness.
            </p>
            <div className="space-y-3">
              <audio
                controls
                className="w-full mt-2 rounded-lg bg-slate-800"
              >
                <source src="/audio/wbtb.mp3" type="audio/mpeg" />
                Your browser does not support audio playback.
              </audio>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/audio/wbtb.mp3"
                  download
                  className="inline-flex items-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
                >
                  Download MP3
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Tonight routine */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-lg shadow-black/40">
          <h2 className="text-xl font-semibold text-slate-50">
            Tonight&apos;s suggested routine
          </h2>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>Log your most recent dream in Onyva if you haven't already.</li>
            <li>Set your intention clearly but gently.</li>
            <li>Use the fall asleep track as you lie down.</li>
            <li>If you wake in the early morning, use the Wake Back To Bed track.</li>
            <li>Record any dream fragments or lucid moments when you wake.</li>
          </ol>
          <p className="text-slate-400">
            Consistency matters more than effort. Lucidity tends to appear when you stay curious,
            relaxed and engaged with your dream world over time.
          </p>
        </section>
      </div>
    </main>
  );
}
