// Uitslagen Grevelingen Wintercup 2026/2027, overgenomen van grevelingencup.nl (ZW-scoring).
// Bijwerken na elke wedstrijd: voeg per groep de rijen toe onder de race-id.
export const RACES = [
  { id: 'r1', date: '2026-10-11', name: 'GC 1', src: { TS: 'https://www.grevelingencup.nl/wp-content/uploads/2026/10/Toer-s-oktober.htm', ORC: 'https://www.grevelingencup.nl/wp-content/uploads/2026/10/ORC-oktober.htm' } },
  { id: 'r2', date: '2026-11-08', name: 'GC 2' },
  { id: 'r3', date: '2026-12-13', name: 'GC 3' },
  { id: 'r4', date: '2027-01-10', name: 'GC 4' },
  { id: 'r5', date: '2027-02-07', name: 'GC 5' },
  { id: 'r6', date: '2027-03-07', name: 'Inhaal', note: 'alleen als er een wedstrijd is uitgevallen' },
  { id: 'r7', date: '2027-03-20', name: 'Finale' },
];
export const RESULTS_SRC = 'Uitslagen van grevelingencup.nl (Uitslagen › Toer-S en ORC klasse), ZW-scoring. Bijgewerkt 11 okt 2026.';

// Rij: [plaats|code, zeilnr (GC), boot, schipper, type, finish, gezeild, gecorrigeerd, punten]
const R = (pl, gc, boat, skip, type, fin, sail, corr, pts) => ({ pl, gc, boat, skip, type, fin, sail, corr, pts });
export const GROUPS = {
  TS1: { title: 'Toer-S groep 1', flag: 'H', start: '11:05', races: { r1: [
    R(1, '171', 'A Boen!!', 'Johan Bol', 'Grand Soleil 34', '13:55:00', '2:50:00', '2:49:49', 1),
    R(2, '803', 'Dream Machine', 'Stefan Marechal', 'Elan 380', '14:00:38', '2:55:38', '2:56:09', 2),
    R(3, '752', 'SEELIG', 'Gertjan Timmers', 'Dehler 38 JV', '14:03:48', '2:58:48', '2:57:54', 3),
    R(4, '796', 'Bierkaai', 'Jeroen de Jong', 'Lutra 40', '13:53:29', '2:48:29', '2:58:29', 4),
    R(5, '817', 'Camelot', 'Nils Bouwman', 'First 40', '14:02:24', '2:57:24', '3:01:08', 5),
    R(6, '807', 'Bruiser', 'Rick Doorneveld', 'J-88', '14:11:06', '3:06:06', '3:02:23', 6),
    R(7, '603', 'Bubbels', 'Andre Kreemer', 'Dehler 36 sq', '14:07:52', '3:02:52', '3:02:48', 7),
    R(8, '774', 'Chicago', 'Ed Groenendijk', 'Archambault Grand Surprise', '14:18:52', '3:13:52', '3:09:59', 8),
    R(9, '808', 'XINIX', 'Paul Ockers', 'Eagle 46', '14:13:38', '3:08:38', '3:10:31', 9),
    R('DNS', '794', 'ZARAFA', 'Brita Van Rossum en Iwan V.', 'HOD 35', '', '', '', 16),
    R('DNS', '257', 'Dehlicious', 'Peter Raijer', 'Dehler 42', '', '', '', 16),
    R('DNS', '769', 'Athoma', 'Laurent de Kerchove', 'Dehler 30 OD', '', '', '', 16),
    R('DNS', '811', 'Sobat Kras', 'Tom Smeets', 'Salona 37', '', '', '', 16),
    R('RET', '757', 'X-Perience', 'Henk van den Berg', 'X-412', '', '', '', 16),
    R('RET', '809', 'Pogoloco', 'K. Jumelet', 'Pogo 30', '', '', '', 16),
  ] } },
  ORC1: { title: 'ORC groep 1', flag: 'K', start: '11:05', races: { r1: [
    R(1, '636', 'Boerderij', 'Jan Ketting', 'BH 36', '13:52:06', '2:47:06', '3:06:37', 1),
    R(2, '625', 'SJamaan', 'Edwin Spaans', 'J35', '13:58:31', '2:53:31', '3:08:35', 2),
    R(3, '643', 'Natural High', 'Fred van Beers', 'Arcona 435', '13:41:24', '2:36:24', '3:10:32', 3),
    R(4, '477', 'Xtra Summer', 'Ruud van Es', 'XP 38', '14:01:17', '2:56:17', '3:20:30', 4),
    R(5, '610', 'Seatrickx', 'Frank Blomsma', 'X-40', '14:07:04', '3:02:04', '3:23:40', 5),
    R('DNF', '812', 'X-C Pole', 'Ivo van der Mark', 'XP33', '', '', '', 9),
    R('DNS', '', 'SOULMATE', 'Leon Westhoeve', 'B&H 41', '', '', '', 9),
    R('RET', '663', 'ZEEBEER 3', 'A.P. van Wijngaarden', 'Waarschip 1076', '', '', '', 9),
  ] } },
  TS2: { title: 'Toer-S groep 2', flag: 'R', start: '11:10', races: { r1: [
    R(1, '747', 'Blauwe Knoop', 'W.P.M. Hermans', 'First 31.7', '13:43:13', '2:33:13', '2:22:29', 1),
    R(2, '301', 'IMP', 'Coen Dusseljee', 'Sun Fast 36', '13:47:49', '2:37:49', '2:33:05', 2),
    R(3, '776', 'Juggernaut', 'Dimitri Vanvyve', 'J-105', '13:48:12', '2:38:12', '2:34:15', 3),
    R(4, '710', 'Javelin', 'J.J. Roth', 'J-80', '14:00:11', '2:50:11', '2:37:01', 4),
    R(5, '259', 'Fungu Yasini', 'G. van Steelant', 'First 31.7', '14:07:46', '2:57:46', '2:42:39', 5),
    R(6, '115', 'Jottum', 'Hans Romers', 'First 35s5', '14:09:27', '2:59:27', '2:44:12', 6),
    R(7, '733', 'Magnifique', 'Mayer Bertin', 'First 31.7', '14:06:55', '2:56:55', '2:45:03', 7),
    R(8, '721', 'Rebel', 'Steven Govaerts', 'First 31.7', '14:08:07', '2:58:07', '2:46:32', 8),
    R(9, '720', 'FF Niks', 'Dirk Meijer', 'Sun Fast 37', '14:15:06', '3:05:06', '2:57:42', 9),
    R(10, '246', 'Sushi', 'Joost Geleijns', 'Comet 33', '14:16:50', '3:06:50', '2:59:57', 10),
    R(11, '731', 'X-Challenge', 'Raphael De Rijcke', 'X-372 Sport', '14:26:17', '3:16:17', '3:10:06', 11),
    R('DNS', '730', 'Joint', 'Sander Zwanenburg', 'J-108', '', '', '', 16),
    R('DNS', '806', 'Java', 'Arthur Caniau', 'J-70', '', '', '', 16),
    R('DNS', '814', 'Viva', 'Carlo Vroon', 'Melges 24', '', '', '', 16),
    R('RET', '773', 'X-RAY', 'Matthijs Priester', 'X3/4 ton MKII', '', '', '', 16),
  ] } },
  TS3: { title: 'Toer-S groep 3', flag: 'W', start: '11:15', races: { r1: [
    R(1, '745', 'Stella Maris', 'Ticco Maagdenberg', 'Contest 37', '13:57:32', '2:42:32', '2:14:54', 1),
    R(2, '804', 'Johnnie', 'Frans Slob', 'Standfast Loper', '14:13:26', '2:58:26', '2:22:45', 2),
    R(3, '116', 'Kelt', 'Bart Zijtregtop', 'Kelt 620', '14:40:51', '3:25:51', '2:29:14', 3),
    R(4, '394', "L'avalanche", 'Dennis Schagen', 'Sun Odyssey 32.2', '14:15:24', '3:00:24', '2:35:29', 4),
    R(5, '326', 'Rooie Rakker', 'Paul Stoelinga', 'Arpège', '14:22:52', '3:07:52', '2:38:00', 5),
    R(6, '816', 'Du Petit Four', 'Erik Langmuur', 'Dufour 36 Classic', '14:23:52', '3:08:52', '2:46:12', 6),
    R(7, '713', 'Keep it Simple', 'Bas van Dijk', 'Spirit 28', '14:36:03', '3:21:03', '2:47:53', 7),
    R('DNS', '787', 'Comodo', 'Theo Sijs', 'Westerly GK24', '', '', '', 11),
    R('DNS', '802', 'Air Mover', 'Robert dHond', 'H-Boot', '', '', '', 11),
    R('DNS', '801', 'Ucane', 'Annelote van Mierlo', 'First 21.1', '', '', '', 11),
  ] } },
};
export const GROUP_ORDER = ['TS1', 'ORC1', 'TS2', 'TS3'];
