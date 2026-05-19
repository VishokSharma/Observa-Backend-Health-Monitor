import React from 'react';
import { Link } from 'react-router-dom';

const tiers = [
  {
    name: 'Starter',
    price: 'Free',
    features: ['Up to 2 services', 'Request + system metrics', 'Community support'],
  },
  {
    name: 'Growth',
    price: '$19/mo',
    features: ['Up to 20 services', 'Alerting + retention', 'Email support'],
  },
  {
    name: 'Scale',
    price: 'Custom',
    features: ['Unlimited services', 'Advanced integrations', 'Priority support'],
  },
];

const PricingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-4xl font-black uppercase tracking-tight">Pricing</h1>
          <Link
            to="/"
            className="bg-ink text-white px-4 py-2 border-2 border-ink font-bold text-sm uppercase tracking-wide"
          >
            Back
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <article key={tier.name} className="bg-white border-2 border-ink shadow-hard p-6">
              <h2 className="text-2xl font-black uppercase tracking-tight">{tier.name}</h2>
              <p className="text-primary text-2xl font-mono font-bold my-4">{tier.price}</p>
              <ul className="space-y-2 text-sm text-ink/80">
                {tier.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
