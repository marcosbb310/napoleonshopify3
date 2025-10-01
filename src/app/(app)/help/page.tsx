// Help & Support page
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { 
  Book, 
  Video, 
  MessageCircle, 
  Mail, 
  Search,
  HelpCircle,
  Zap,
  DollarSign,
  Package,
  BarChart3,
} from 'lucide-react';
import { useState } from 'react';

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const quickLinks = [
    {
      title: 'Getting Started',
      description: 'Learn the basics of Smart Pricing',
      icon: Zap,
      href: '#getting-started',
    },
    {
      title: 'Pricing Strategies',
      description: 'Optimize your pricing approach',
      icon: DollarSign,
      href: '#pricing-strategies',
    },
    {
      title: 'Product Management',
      description: 'Manage your product catalog',
      icon: Package,
      href: '#product-management',
    },
    {
      title: 'Analytics & Insights',
      description: 'Understand your performance data',
      icon: BarChart3,
      href: '#analytics',
    },
  ];

  const faqs = [
    {
      question: 'How does Smart Pricing work?',
      answer: 'Smart Pricing uses AI-powered algorithms to automatically adjust your product prices based on demand, competition, inventory levels, and historical performance. You set the parameters (min/max prices, target margins), and our system optimizes pricing in real-time.',
    },
    {
      question: 'Will prices change too frequently?',
      answer: 'No. You control the update frequency (real-time, hourly, or daily) and set maximum price change thresholds. The system will never change a price by more than your specified percentage without your approval.',
    },
    {
      question: 'How do I connect my Shopify store?',
      answer: 'Go to Settings → Stores, click "Connect New Store", and enter your store URL and Admin API access token. You can get your access token from your Shopify admin panel under Apps → Develop apps.',
    },
    {
      question: 'Can I manually override automated prices?',
      answer: 'Yes! You can manually edit any product price at any time. Your manual changes will override automated pricing until you enable automation for that product again.',
    },
    {
      question: 'What happens to my Shopify store if I disconnect?',
      answer: 'Your products and prices remain unchanged in Shopify. We simply stop monitoring and adjusting prices. You can reconnect at any time without losing your settings.',
    },
    {
      question: 'How are profit margins calculated?',
      answer: 'Profit margin = ((Price - Cost) / Price) × 100. You can set product costs in the product details, and we\'ll automatically calculate and display profit margins for each price point.',
    },
    {
      question: 'Can I use Smart Pricing for multiple stores?',
      answer: 'Yes! Pro and Enterprise plans support multiple Shopify stores. You can switch between stores from the user menu or Settings → Stores.',
    },
    {
      question: 'What data is used for pricing decisions?',
      answer: 'We analyze sales velocity, conversion rates, inventory levels, historical pricing performance, seasonal trends, and competitor pricing (if enabled) to make data-driven pricing recommendations.',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-muted-foreground">
          Find answers and get help with Smart Pricing
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => (
          <Card key={link.title} className="hover:border-primary cursor-pointer transition-colors">
            <CardHeader>
              <link.icon className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">{link.title}</CardTitle>
              <CardDescription className="text-xs">
                {link.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* FAQs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
          <CardDescription>
            Quick answers to common questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Resources */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <Book className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-base">Documentation</CardTitle>
            <CardDescription>
              Comprehensive guides and tutorials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              View Docs
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Video className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-base">Video Tutorials</CardTitle>
            <CardDescription>
              Step-by-step video guides
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Watch Videos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <MessageCircle className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-base">Live Chat</CardTitle>
            <CardDescription>
              Chat with our support team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Start Chat
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Contact Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Still Need Help?
          </CardTitle>
          <CardDescription>
            Our support team is here to help you succeed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Email Support</p>
              <p className="text-sm text-muted-foreground">support@smartpricing.com</p>
              <p className="text-xs text-muted-foreground">Response time: 2-4 hours</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Priority Support</p>
              <p className="text-sm text-muted-foreground">Available for Pro & Enterprise</p>
              <Badge variant="secondary">Pro Feature</Badge>
            </div>
          </div>
          <Button>
            <Mail className="mr-2 h-4 w-4" />
            Contact Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

