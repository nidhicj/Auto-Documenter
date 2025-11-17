'use client'

import Link from 'next/link'
import { BookOpen, FileText, Share2, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            Scribe AI
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Capture workflows, create guides, generate documentation
          </p>
          <Link
            href="/guides"
            className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
          >
            Get Started
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="Capture Workflows"
            description="Record screenshots and DOM actions automatically"
          />
          <FeatureCard
            icon={<BookOpen className="w-8 h-8" />}
            title="Step-by-Step Guides"
            description="Auto-generate editable guides from your workflows"
          />
          <FeatureCard
            icon={<FileText className="w-8 h-8" />}
            title="AI Documentation"
            description="Generate professional documentation with AI"
          />
          <FeatureCard
            icon={<Share2 className="w-8 h-8" />}
            title="Share & Embed"
            description="Export as PDF, HTML, or embed in your site"
          />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: any) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
      <div className="text-primary-600 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}



