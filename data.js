// Programme de départ : « Busy Girl » (phase 1 saisie d'après les captures, phase 2 à venir).
// Une séance = { name, duration, description, objective, muscles[], equipment[], exercises[] }
// Un exercice = { name, group, sets, reps, perSide }  (reps = texte libre : "12", "8-10", "30 sec", "15-20 min")
(function () {
  let n = 0;
  const id = () => 's' + (++n).toString(36);
  const ex = (group, name, sets, reps, perSide = false) => ({ id: id(), group, name, sets, reps, perSide });

  const WARM = 'Échauffement';
  const warmupLower = (catCowPerSide) => [
    ex(WARM, 'Squat Profond et Extension de Genoux', 1, '10'),
    ex(WARM, 'Deep Lunges Dynamiques', 1, '5', true),
    ex(WARM, 'Ouverture de Hanches', 1, '10', true),
    ex(WARM, 'Leg Swing Frontal', 1, '10', true),
    ex(WARM, 'Cat Cow', 1, '5', catCowPerSide),
  ];

  const sessions = [
    {
      id: id(), name: 'Booty Shape & Cardio', duration: 40,
      description: "Une séance ciblée sur les fessiers pour renforcer et développer le bas du corps, avec un travail complet des muscles fessiers. En option si tu en as le temps et l'envie, termine avec 15 à 20 min de marche inclinée sur le tapis. Si tu t'entraînes à la maison, tu peux aller marcher en extérieur.",
      objective: 'Renforcer les fessiers et les ischio-jambiers tout en améliorant la stabilité des hanches et du tronc.',
      muscles: ['Fessiers', 'Bas du corps', 'Ischios', 'Quadriceps'],
      equipment: ['Abducteur machine', 'Banc', 'Box/step', 'Disque', 'Machine hip thrust', 'Smith machine'],
      exercises: [
        ...warmupLower(false),
        ex('Exercice 1', 'Abductions', 2, '15-20'),
        ex('Exercice 2', 'Hip Thrust - Machine', 3, '12'),
        ex('Exercice 3', 'Fentes Bulgares - Smith Machine', 2, '10', true),
        ex('Exercice 4', 'Glute Hyperextension - Disque', 2, '12-15'),
        ex('Exercice 5', 'Marche Inclinée Modérée 4% ou Dehors (optionnel)', 1, '15-20 min'),
      ],
    },
    {
      id: id(), name: 'Upper Pilates & Abs', duration: 35,
      description: "Une séance complète axée sur le haut du corps, la mobilité et le renforcement de la sangle abdominale, avec un travail du dos et des triceps suivi de circuits ciblant le haut du corps, les lombaires et les abdominaux.",
      objective: 'Renforcer le haut du corps, améliorer sa force et la stabilité du tronc.',
      muscles: ['Abs', 'Bras', 'Dos', 'Haut du corps', 'Dorsaux'],
      equipment: ['Banc', 'Élastique', 'Haltère', 'Poulie', 'Tapis de sol'],
      exercises: [
        ex(WARM, 'Chien Tête en Bas et Cobra Pose', 1, '10'),
        ex(WARM, 'Cat Cow', 1, '5'),
        ex(WARM, 'Avant Arrière', 1, '10'),
        ex(WARM, 'Around The World', 1, '5', true),
        ex('Exercice 1', 'Tirage Vertical - Prise Large', 3, '12'),
        ex('Exercice 2 - Superset', 'Triceps Extensions Overhead - Haltère', 3, '12'),
        ex('Exercice 2 - Superset', 'Around The World - Haltères', 3, '10'),
        ex('Exercice 3', 'Cobra Stretch', 3, '8'),
        ex('Exercice 3', 'Arm Raise au Sol', 3, '8'),
        ex('Exercice 3', 'Around The World Raise', 3, '8'),
        ex('Exercice 3', 'Superman Dynamique', 3, '8'),
        ex('Exercice 3', 'Superman Hold', 3, '20 sec'),
        ex('Exercice 4', 'Glute Bridge Marche - Haltère', 3, '30 sec'),
        ex('Exercice 4', 'Sit Ups - Haltère', 3, '30 sec'),
        ex('Exercice 4', 'Dead Bug - Haltère', 3, '30 sec'),
        ex('Exercice 4', 'Hollow Hold', 3, '30 sec'),
      ],
    },
    {
      id: id(), name: 'Booty Tone & Cardio', duration: 40,
      description: "Une séance ciblée sur l'ensemble du bas du corps, avec un travail complet. En option si tu as le temps et l'envie, termine avec 15 à 20 min de stairmaster (remplaçable par de la marche sur tapis). Si tu t'entraînes à la maison, tu peux aller marcher en extérieur.",
      objective: 'Tonification, Perte de Poids',
      muscles: ['Glutes', 'Bas du corps', 'Fessiers', 'Ischio-jambiers', 'Quadriceps'],
      equipment: ['Disque', 'Haltère', 'Machine hip thrust', 'Poulie', 'Stairmaster'],
      exercises: [
        ...warmupLower(true),
        ex('Exercice 1', 'Hip Thrust - Machine', 3, '8-10'),
        ex('Exercice 2 - Superset', 'Romanian Deadlift - Haltères', 3, '10-12'),
        ex('Exercice 2 - Superset', 'Sumo Squat - Haltère', 3, '12-15'),
        ex('Exercice 3', 'Step Up - Haltère', 2, '10', true),
        ex('Exercice 4', 'Kick Back - Poulie', 2, '12', true),
        ex('Exercice 5', 'Stairmaster ou Marche Dehors (optionnel)', 1, '15-20 min'),
      ],
    },
    {
      id: id(), name: 'Cardio & Abs', duration: 45,
      description: "Améliore ton cardio grâce à la marche et renforce ta sangle abdominale avec un circuit de gainage. Dans cette séance, la marche sur tapis peut être remplacée par de la marche en extérieur, notamment si tu t'entraînes à la maison.",
      objective: 'Tonification, Perte de Poids',
      muscles: ['Abs', 'Full body', 'Cardio'],
      equipment: ['Haltère', 'Tapis de course', 'Tapis de sol'],
      exercises: [
        ex('Exercice 1', 'Marche Inclinée Modérée 2% ou Dehors', 1, '35-45 min'),
        ex('Exercice 2', 'Rolling Plank', 3, '30 sec'),
        ex('Exercice 2', 'Side Plank Crunch Raise Droit - Haltère', 3, '30 sec', true),
        ex('Exercice 2', 'Side Plank Crunch Raise Gauche - Haltère', 3, '30 sec', true),
        ex('Exercice 2', 'Plank', 3, '30 sec'),
      ],
    },
  ];

  window.SEED_PROGRAMS = [{
    id: 'busygirl',
    name: 'Busy Girl',
    emoji: '👛',
    color: 0,
    description: '2 phases de 4 semaines · 4 séances par semaine',
    phases: [
      { name: 'Phase 1', weeks: 4, sessions },
      { name: 'Phase 2', weeks: 4, sessions: [] },
    ],
  }];
})();
