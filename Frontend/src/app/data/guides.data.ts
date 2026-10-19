import { Guide } from '../models/guide';

export const GUIDES: Guide[] = [
  {
    slug: 'crystal-buying-guide',
    title: 'Crystal Buying Guide',
    shortDescription: 'New to collecting crystals? Start here for practical tips on choosing your first pieces.',
    sections: [
      {
        heading: 'Start with what draws your eye',
        paragraphs: [
          'There is no single "correct" way to choose a crystal. Many collectors simply start with a stone whose color, shape, or texture they find appealing, and build their collection from there.',
          'If you are shopping with a particular intention in mind - for example, a stone associated with your zodiac sign - it can help to read a little about that stone first so you know what to expect in terms of size, form, and typical price range.'
        ]
      },
      {
        heading: 'Decide on a form',
        paragraphs: [
          'Crystals are commonly sold as raw (unpolished, natural) pieces, tumbled (smooth, polished) stones, or shaped into towers, spheres, and other decorative forms. Each form suits a different use - raw pieces are popular for display and collecting, while tumbled stones are easy to carry or hold.'
        ]
      },
      {
        heading: 'Check quality and condition',
        paragraphs: [
          'Look at product photos closely, and check the stock and description details on the product page for size, weight, or included variations. If you are ever unsure, our customer support team is happy to help before you order.'
        ]
      }
    ],
    relatedLinks: [
      { label: 'Browse All Products', path: '/products' },
      { label: 'Shop by Category', path: '/categories' }
    ]
  },
  {
    slug: 'crystal-care',
    title: 'How to Care for Your Crystals',
    shortDescription: 'Simple, practical guidance for keeping your crystals clean and looking their best.',
    sections: [
      {
        heading: 'Cleaning',
        paragraphs: [
          'Most tumbled and polished crystals can be gently wiped with a soft, slightly damp cloth. Avoid harsh chemical cleaners, which can dull or damage the surface of softer stones.',
          'Some crystals, such as selenite, are naturally soft and can be damaged by water - for these, a dry, soft cloth is the safer choice.'
        ]
      },
      {
        heading: 'Storage',
        paragraphs: [
          'Store crystals away from direct, prolonged sunlight if you want to preserve their original color, as some stones can fade over time with heavy sun exposure.',
          'Keeping stones separated (for example, in small pouches or a lined tray) helps prevent harder crystals from scratching softer ones during storage.'
        ]
      },
      {
        heading: 'Handling',
        paragraphs: [
          'Crystals, especially raw or pointed pieces, can be brittle. Handle them gently and avoid dropping them onto hard surfaces.'
        ]
      }
    ],
    relatedLinks: [
      { label: 'Browse All Products', path: '/products' }
    ]
  },
  {
    slug: 'raw-vs-tumbled',
    title: 'Raw vs Tumbled Crystals',
    shortDescription: 'Understand the difference between natural raw crystals and smooth, polished tumbled stones.',
    sections: [
      {
        heading: 'Raw crystals',
        paragraphs: [
          'Raw crystals are left in their natural, unpolished state. Every raw piece is unique, with its own shape, texture, and natural facets - making them popular for display, collecting, and gifting.'
        ]
      },
      {
        heading: 'Tumbled crystals',
        paragraphs: [
          'Tumbled stones are polished smooth, usually in a rotating tumbler with abrasive grit, until their surface is glossy and rounded. They are compact, comfortable to hold, and a popular starting point for new collectors.'
        ]
      },
      {
        heading: 'Which should you choose?',
        paragraphs: [
          'If you enjoy natural, one-of-a-kind pieces for display, raw crystals may suit you better. If you want something smooth and portable, tumbled stones are usually the easier choice. Many collectors simply enjoy both.'
        ]
      }
    ],
    relatedLinks: [
      { label: 'Shop by Category', path: '/categories' },
      { label: 'Browse All Products', path: '/products' }
    ]
  },
  {
    slug: 'crystal-towers-explained',
    title: 'Crystal Towers Explained',
    shortDescription: 'What crystal towers are, and why they make popular home and desk decor.',
    sections: [
      {
        heading: 'What is a crystal tower?',
        paragraphs: [
          'A crystal tower is a stone that has been cut and polished into a tall, pointed shape, similar to a natural crystal point but with a more uniform, symmetrical form.'
        ]
      },
      {
        heading: 'Common uses',
        paragraphs: [
          'Towers are frequently used as home or desk decor, as a centerpiece in a stone collection, or simply appreciated for their polished, sculptural shape.'
        ]
      }
    ],
    relatedLinks: [
      { label: 'Browse All Products', path: '/products' }
    ]
  },
  {
    slug: 'crystal-spheres-explained',
    title: 'Crystal Spheres Explained',
    shortDescription: 'A short guide to crystal spheres (crystal balls) and what makes them a popular decorative choice.',
    sections: [
      {
        heading: 'What is a crystal sphere?',
        paragraphs: [
          'A crystal sphere is a stone carved and polished into a smooth, round ball. Because of the amount of material and precision required, spheres are typically among the more premium decorative crystal shapes.'
        ]
      },
      {
        heading: 'Displaying a sphere',
        paragraphs: [
          'Crystal spheres are often displayed on a small stand or ring to keep them from rolling, and make an eye-catching centerpiece on a shelf, desk, or windowsill.'
        ]
      }
    ],
    relatedLinks: [
      { label: 'Browse All Products', path: '/products' }
    ]
  },
  {
    slug: 'crystals-by-zodiac-sign',
    title: 'Crystals by Zodiac Sign',
    shortDescription: 'Explore which crystals are traditionally associated with each of the twelve zodiac signs.',
    sections: [
      {
        heading: 'A tradition of pairing stones with signs',
        paragraphs: [
          'For generations, certain crystals have been informally associated with each zodiac sign, often based on color, folklore, or the sign\'s traditional element (fire, earth, air, or water). These associations are a matter of tradition and personal interest rather than scientific fact.',
          'Many shoppers enjoy choosing a crystal linked to their own sign, or the sign of someone they are buying a gift for, as a fun and personal way to connect with a piece.'
        ]
      },
      {
        heading: 'Explore your sign',
        paragraphs: [
          'Visit our Zodiac Signs section to see the crystals we\'ve grouped with each sign, and browse the full collection for that sign in one place.'
        ]
      }
    ],
    relatedLinks: [
      { label: 'Find My Crystal', path: '/zodiac' },
      { label: 'Shop by Category', path: '/categories' }
    ]
  },
  {
    slug: 'how-to-choose-a-crystal',
    title: 'How to Choose a Crystal',
    shortDescription: 'A few simple questions to help narrow down your options when browsing our collection.',
    sections: [
      {
        heading: 'Ask yourself a few questions',
        paragraphs: [
          'What will you use it for - display, gifting, or something to carry with you? Do you prefer a natural, raw look or a smooth, polished finish? Is there a color or stone type you\'re already drawn to?',
          'If you\'re shopping for yourself or someone else based on a zodiac sign, our "Find My Crystal" tool is a quick way to see stones associated with a particular sign.'
        ]
      },
      {
        heading: 'Use our filters',
        paragraphs: [
          'Our product listing page lets you filter by category, zodiac sign, price range, and stock availability, making it easier to narrow down a large collection to just a few options worth a closer look.'
        ]
      }
    ],
    relatedLinks: [
      { label: 'Find My Crystal', path: '/zodiac' },
      { label: 'Browse All Products', path: '/products' },
      { label: 'Shop by Category', path: '/categories' }
    ]
  }
];
