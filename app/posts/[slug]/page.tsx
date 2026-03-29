import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { prisma } from "@/lib/prisma";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const post = await prisma.post.findUnique({ where: { slug: params.slug } });
  if (!post) return { title: "Post not found" };
  return { title: post.title };
}

export default async function PostDetailPage({ params }: Props) {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
  });

  if (!post) notFound();

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Deal blog post</p>
        <h1 className="font-display text-4xl font-semibold text-ink">{post.title}</h1>
        {post.publishedAt ? (
          <p className="text-sm text-ink-muted">
            {post.publishedAt.toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
        ) : null}
      </header>

      <div className="prose prose-neutral max-w-none prose-headings:font-display prose-a:text-accent dark:prose-invert">
        <ReactMarkdown>{post.body}</ReactMarkdown>
      </div>

      <p className="text-sm text-ink-muted">
        For live multi-store prices and charts, open products from the{" "}
        <Link href="/search" className="font-medium text-accent hover:underline">
          catalog
        </Link>
        .
      </p>
    </article>
  );
}
