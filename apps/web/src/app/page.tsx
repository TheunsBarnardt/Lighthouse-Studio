export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-bold text-primary">Lighthouse Studio</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Self-hosted AI development platform with data management and AI build pipeline.
        </p>
        <div className="mt-8 flex gap-4">
          <a
            href="/data-management"
            className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Data Management
          </a>
        </div>
      </div>
    </main>
  );
}
