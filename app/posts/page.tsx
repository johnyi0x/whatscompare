import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function PostsIndexPage() {
  const posts = await prisma.post.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Deal write-ups</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Editorial posts that embed curated products—WordPress-free, stored as markdown in Postgres.
        </p>
      </div>
      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/posts/${post.slug}`}
              className="block rounded-xl border border-ink/10 bg-surface p-5 transition hover:border-accent/40"
            >
              <h2 className="font-display text-xl font-semibold text-ink">{post.title}</h2>
              {post.excerpt ? <p className="mt-2 text-sm text-ink-muted line-clamp-2">{post.excerpt}</p> : null}
              {post.publishedAt ? (
                <p className="mt-3 text-xs text-ink-muted">
                  Published {post.publishedAt.toLocaleDateString("en-US", { dateStyle: "long" })}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {posts.length === 0 ? (
        <p className="text-ink-muted">No published posts yet. Run the seed script to add a sample roundup.</p>
      ) : null}
    </div>
  );
}
