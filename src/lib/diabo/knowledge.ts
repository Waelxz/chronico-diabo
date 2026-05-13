import type { KbTopic } from '@/lib/db/kb';

/**
 * Sprint-3 seed knowledge base for Diabo (FR, Maghreb-aware).
 *
 * Editorial principles:
 *   - **No specific medical numbers** (no HbA1c targets, no insulin doses,
 *     no glycemic ranges in mg/dL). Those are MD-territory.
 *   - **Always escalate** to a doctor or emergency services for anything
 *     serious. The KB is general lifestyle guidance only.
 *   - **Maghreb-specific food references** (couscous, brik, pain, dattes,
 *     harira, makroud) where useful — that's the value-add over generic
 *     French diabetes content.
 *   - **No copy-paste from copyrighted sources** — paraphrased general
 *     knowledge from FID / OMS / AFD public guidance.
 *
 * To re-seed: `node scripts/seed-kb.mjs` (idempotent — upserts by `title`).
 */

export type KbSeedChunk = {
  topic: KbTopic;
  title: string;
  content: string;
};

export const KB_SEED: KbSeedChunk[] = [
  {
    topic: 'concept',
    title: 'Qui est Diabo',
    content:
      "Diabo est un compagnon IA empathique pour les personnes vivant avec le diabète, conçu pour le public francophone du Maghreb. Il accompagne au quotidien sur l'alimentation, l'activité, le mental et le suivi, sans jamais remplacer le médecin traitant. Il fait partie de la famille Chronico d'IA pour les maladies chroniques.",
  },
  {
    topic: 'concept',
    title: 'Différence diabète type 1 et type 2',
    content:
      "Le diabète de type 1 est une maladie auto-immune où le pancréas ne produit plus d'insuline ; il survient souvent jeune et nécessite des injections d'insuline. Le diabète de type 2 est plus fréquent, lié à une résistance à l'insuline ; il peut souvent être amélioré par l'alimentation, l'activité physique et parfois des médicaments. Le diagnostic et le traitement reviennent au médecin.",
  },
  {
    topic: 'food',
    title: 'Aliments à privilégier au quotidien',
    content:
      'Les légumes (cuits ou crus, tous les jours), les légumineuses (lentilles, pois chiches, haricots — comme dans la harira), les céréales complètes (pain complet, couscous complet, orge), les fruits frais entiers en quantité modérée, les protéines maigres (poisson, poulet, œufs), et les bonnes graisses (huile d\'olive, amandes, noix). Boire de l\'eau régulièrement.',
  },
  {
    topic: 'food',
    title: 'Aliments à modérer',
    content:
      "Les sodas et jus sucrés (à éviter au quotidien), les pâtisseries (baklawa, makroud, cornes de gazelle) à garder pour les occasions, le pain blanc en grande quantité, les fritures fréquentes, et les dattes en excès (3-4 max par jour suffit pour la plupart des personnes). Ce n'est pas de l'interdit, c'est de la modération — l'équilibre se joue sur la semaine.",
  },
  {
    topic: 'food',
    title: 'Manger équilibré avec un budget serré',
    content:
      "Les légumineuses sèches (lentilles, pois chiches) sont peu chères, rassasiantes et excellentes pour la glycémie. Les légumes de saison du souk (courgettes, tomates, carottes, poivrons) coûtent peu et apportent fibres et vitamines. Le pain complet est à peine plus cher que le pain blanc. Une harira maison avec beaucoup de légumes et de lentilles est un repas complet et abordable.",
  },
  {
    topic: 'activity',
    title: 'Quelle activité physique commencer',
    content:
      "La marche est l'activité la plus accessible : 20 à 30 minutes par jour, à un rythme un peu plus rapide que la promenade, suffit pour aider la glycémie. Tu peux aussi nager, faire du vélo, ou danser. L'important est la régularité, pas l'intensité. Si tu prends de l'insuline, parle à ton médecin avant de commencer un sport intense — il peut être nécessaire d'ajuster les doses.",
  },
  {
    topic: 'monitoring',
    title: 'À quoi sert l\'autosurveillance glycémique',
    content:
      "Mesurer sa glycémie permet de mieux comprendre comment ton corps réagit à tel aliment, telle activité, ou tel stress. Ce n'est pas un examen à réussir : c'est une information. Note tes mesures dans un carnet ou une appli, avec le contexte (repas, sport, sommeil), et discutes-en avec ton médecin. Les cibles personnalisées dépendent de chaque personne — c'est le médecin qui les fixe.",
  },
  {
    topic: 'hypo',
    title: 'Signes d\'hypoglycémie et que faire',
    content:
      "Signes : sueurs froides, tremblements, fringale soudaine, palpitations, vision trouble, difficulté à se concentrer. Si tu reconnais ces signes, prends rapidement du sucre rapide (3 morceaux de sucre, ou un petit verre de jus de fruits, ou une cuillère de miel), attends 15 minutes, puis remange un féculent. Si tu perds connaissance ou si quelqu'un autour de toi est très confus, appelle les urgences immédiatement.",
  },
  {
    topic: 'hyper',
    title: 'Signes d\'hyperglycémie',
    content:
      "Signes fréquents : soif intense, besoin d'uriner souvent, fatigue inhabituelle, vision floue, bouche sèche. Si ces symptômes persistent plusieurs jours, ou s'ils s'accompagnent de nausées, vomissements, douleur au ventre, respiration rapide, ou haleine fruitée, il faut contacter ton médecin ou aller aux urgences sans attendre — cela peut être une acidocétose, qui est grave.",
  },
  {
    topic: 'mental',
    title: 'La charge mentale du diabète',
    content:
      "Vivre avec le diabète demande de penser, mesurer, ajuster, anticiper, plusieurs fois par jour. Cette charge mentale est réelle et c'est normal de se sentir fatigué.e par moments, voire découragé.e. Parler à un proche, à un.e psychologue, ou à un groupe de patients (associations comme l'AJD ou l'AFD en France, ou les associations locales) aide souvent. Tu n'es pas seul.e.",
  },
  {
    topic: 'mental',
    title: 'Stress et glycémie',
    content:
      "Le stress libère des hormones (cortisol, adrénaline) qui peuvent faire monter la glycémie même sans avoir mangé. La respiration lente (5 secondes inspire, 5 secondes expire pendant 2-3 minutes), une courte marche, ou parler à quelqu'un sont des outils simples pour apaiser le système nerveux. Le sommeil régulier joue aussi beaucoup.",
  },
  {
    topic: 'travel',
    title: 'Voyager avec le diabète',
    content:
      "Garde toujours ton matériel (insuline, lecteur, bandelettes, sucre rapide) en bagage cabine — jamais en soute (le froid peut altérer l'insuline). Prends une ordonnance et un certificat médical (pratique aux frontières). Adapte tes horaires de traitement aux fuseaux horaires en parlant à ton médecin avant le départ. Et amuse-toi : le diabète ne doit pas t'empêcher de voyager.",
  },
  {
    topic: 'ramadan',
    title: 'Ramadan et diabète — précautions',
    content:
      "Jeûner avec un diabète est possible pour certaines personnes mais nécessite **impérativement** un avis médical préalable. Le médecin évalue ton type de diabète, ton traitement (l'insuline et certains médicaments peuvent rendre le jeûne dangereux), et ton état général. Si tu jeûnes : hydrate-toi bien entre l'iftar et le sohour, garde un repas équilibré (légumes, féculents complets, protéines, peu de pâtisseries), et romps le jeûne immédiatement si tu sens une hypoglycémie.",
  },
  {
    topic: 'pregnancy',
    title: 'Diabète et grossesse',
    content:
      "Une grossesse avec un diabète préexistant, ou un diabète gestationnel découvert pendant la grossesse, demande un suivi médical rapproché (diabétologue, gynécologue, parfois nutritionniste). Les cibles glycémiques sont plus strictes pendant cette période. N'hésite pas à consulter dès le projet de grossesse pour optimiser ta santé en amont.",
  },
];
