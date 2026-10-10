# Deelnemerslijst Grevelingencup 2026/2027 (afbeelding van Stefan, 10 okt 2026) + ratings uit uitslagen grevelingencup.nl
import json
L = """A BOEN|Grand Soleil 34|Wemeldinge|TS||NED 9880|171
AIR MOVER|H-Boot|Andeouddorp|TS|||802
ALOHA|Westerly GK 29|Noordschans|TS|||810
ATHOMA|Dehler 30OD|Cadzand|TS||BEL 2728|769
AURORA|Bavaria 30cr||TS|||493
AURORA|Elan 33|WSV Haringvliet|ORC||NED 9153|
AXEZ|Beneteau Oceanis 46|Marina Port Zelande|T|MPZ||649
BAKVIS|Dehler 35 CWS|Marina Port Zelande|T||NED 8643|312
BELUGA|Rival 34|WV Zierikzee|T|||677
BENEVOLANT|Beneteau Oceanis 50|Noordschans|T|||771
BIERKAAI|Lutra 40|Willemstad|TS||NED 3|796
BIG BANG|Dufour 44|Brouwershaven|T||NED 862|444
BLACK PEARL|Beneteau Oceanis 46|Bruinisse|T||NED 8029|768
BLAUWE KNOOP|First 31.7|Sint Annaland|TS||NED 7001|747
BLIZZARD|Salona 38|Wolphaartsdijk|TS||NED 8404|204
BLIZZARD OF UZ|Sunfast 3200|Marina Port Zelande|ORC|MPZ|IRL 3208|698
BOB|Spirit 32|Gent|T|||275
BOBBIE|Hanse 400|Den Osse|T||BEL 2780|451
BOERDERIJ|BH 36|WV Zierikzee|ORC||FIN 9806|636
BROCKY|Beneteau First 33.7|Bruinisse|T||ESP 4769|795
BRUISER|J88|Goeree|TS|||807
BUBBELS|Dehler 36 sq|Ouddorp|TS|||604
CAMELOT|First 40|Veere|TS|||472
CARPE TRIEM|Outrigger 26|WV Saeftinghe|MH|||813
CHICAGO|Archambault Grand Surprise|Willemstad|TS|||774
CLOUD9|Jeanneau 379|Marina Port Zelande|T|||656
COMODO|Westerly GK 24|Zeewolde|TS|||787
DANAE|Dehler 41 CR|Herkingen|T|||789
DEHLICIOUS|Dehler 42|Marina Port Zelande|TS|MPZ||257
DETOX|X-362|WSV Haringvliet|T|||792
DOMAR|Contest 25oc|Noordschans|T|||684
DREAM MACHINE|Elan 380|Bruinisse|TS|||803
DU PETIT FOUR|Dufour 36 Classic|Marina Port Zelande|TS|||487
EFFENIX|X-37|Colijnsplaat|T|||635
FARFELU|F&F 915|Sint-Annaland|ORC||BEL 27253|798
FF NIKS|Jeanneau Sun Fast 37|Den Osse|TS|||720
FISSA|Bavaria 34C|Sint Annaland|T|||658
FUNGU YASINI|First 31.7|Brouwershaven|TS|||481
GAVIOTA|Bavaria 37 Cruiser|Den Osse|T|||311
HABIBI|Bavaria 37 Cruiser|Bruinisse|T|||632
HET VERSTAND VAN POEH|Trimaran Kraken 33|Stad aan het Haringvliet|MH|||770
IMP|Sun Fast 36|WSV Blinckvliet|TS|||301
INEPTIAS|Beneteau First 37.5|Bruinisse|T|||671
JAVA|J70|France|TS|||806
JAVELIN|J80|Scharendijke|TS|||710
JOHNNIE|Standfast Loper|Hellevoetsluis|TS|||804
JOINT|J-108|Marina Port Zelande|TS|MPZ|NED 9108|730
JOTTUM|Beneteau First 35|Hellevoetsluis|TS|||115
JUGGERNAUT|J105|Blankenberge|TS|||776
KEEP IT SIMPLE|Spirit 28|Willemstad|TS|||713
KELT|Kelt 6.20|Scharendijke|TS|||116
KOKKO|Hanse 371|Brouwershaven|T|||495
LARUS|Dufour 31|Marina Port Zelande|T|MPZ||554?
L'AVALANCHE|Jeanneau Sun Odyssey 32.2|St. Annaland|TS|||394
LILITH|Bavaria 36|Marina Port Zelande|T|||805
LIONHEART|vd Stad 40 Caribean|Den Osse|T||NED 5701|704
LIVANTO|Dehler 38|Nog geen ligplaats|T|||782
LOOS|Dufour 40|Marina Port Zelande|T|MPZ||627
MAC SEA|Bavaria 37|Bruinisse|T|||646
MAGNIFIQUE|First 31.7|Marina Port Zelande|TS|MPZ||733
MANASLU|Dufour 40|Noordschans|T|||760
MARLIN|Bavaria 39cr|NVT|T|||775
MATTIE|Bavaria 32|Colijnsplaat|T|||763
NATURAL HIGH|Arcona 435|Bruinisse|TS||9435|643
O2|Waarschip|Veere|T|||764
ORION|Contest 38|Sint Annaland|T|||779
OVERRULED|One-off|WSV Herkingen|ORC||NED 6371|335
PHANTASIA|Gib Sea 126|Ouddorp|T|||686
POGOLOCO|Pogo 30|Veere|TS|||809
POPEYE|Winner 8p|Luxemburg|T|||685
REBEL|First 31.7|Wemeldinge (Antwerpen?)|TS|||721
ROOIE RAKKER|Dufour Arpège 1.35|Brouwershaven|TS||8670|326
SAFFIER SE 33 GP|Saffier 33|IJmuiden|ORC||NED 1332|
SCALDIS|Kalik 103|Middelharnis|T|||336
SEATRICKX|X4.0|Herkingen|ORC||NED 5040|610
SEELIG|Dehler 38 JV-2018|Willemstad|TS||NED 1838|752
SERENA|Dehler 35 CWS|Gorinchem|T|||130
SJAMAAN|J35|Zierikzee|TS||NED 3501|625
SOBAT KRAS|Salona 37|Bruinisse|TS|||811
SOULMATE|B&H 41|Wolphaartsdijk|ORC||NED 5596|
STELLA MARIS|Contest 37|Willemstad|TS|||745
STORMVOGEL II|Hanse 400E|WSV Herkingen|T|||762
STRESS BREAKER|Dehler 34 (Optima 101)|Strijensas|T|||701
SUNSEA|Catalina 36|Bruinisse|T|||786
SUSHI|Comet 33|Herkingen|TS||NED 8594|246
TRI4FIVE|Corsair F27|Herkingen|MH|||756
UCANE|First 21.1|Brouwershaven|TS|||801
VINDIO|Grand Soleil 37|Wolphaartsdijk|ORC||ESP 8228|606
VIVA|Melges 24|Breskens|TS|||814
WILDE BRAS|Spirit 36|WSV Brouwershaven|T|||120
X-CHALLENGE|X-372 Sport|Colijnsplaat|TS|||731
XINIX|Eagle 46|Cape Helius Hellevoetsluis|TS|||808
X-PERIENCE|X-412|WSV Goeree|TS|||757
X-POLE|XP33|Marina Port Zelande|TS|MPZ|DEN 6842|812
X-RAY|X3/4|WSV Blinckvliet|TS|||773
XTRA SUMMER|XP38|Bruinisse|ORC||NED 9138|477
YIPPI YO|Farrier F31r CC|Noordschans|MH|||436
ZARAFA|HOD 35|Breskens|TS|||794
ZEEBEER 3|Waarschip 1076|Den Osse|ORC||NED 5146|663
ZOMERHITTE 2.0|Dehler 42|Bruinisse|T|||661"""
S25 = 'uitslag 2025/26'
# factor, bron
R = {
 'A BOEN':(0.9989,S25),'ATHOMA':(1.0200,S25),'BIERKAAI':(1.0594,S25),'BLAUWE KNOOP':(0.9300,S25),'BUBBELS':(0.9996,S25),
 'CHICAGO':(0.9800,S25),'COMODO':(0.8150,S25),'DEHLICIOUS':(1.0322,S25),'FUNGU YASINI':(0.9150,S25),'IMP':(0.9700,S25),
 'JAVELIN':(0.9226,S25),'JOINT':(0.9646,S25),'JOTTUM':(0.9150,S25),'JUGGERNAUT':(0.9750,S25),'KEEP IT SIMPLE':(0.8350,S25+' (laatste)'),
 'KELT':(0.7250,S25),'MAGNIFIQUE':(0.9329,S25),'REBEL':(0.9350,S25),'ROOIE RAKKER':(0.8668,S25),'SEELIG':(0.9950,S25),
 'STELLA MARIS':(0.8300,S25),'X-CHALLENGE':(0.9685,S25),'X-RAY':(0.9500,S25),'ZARAFA':(0.9925,S25),
 "L'AVALANCHE":(0.8619,'uitslag 2023/24'),'NATURAL HIGH':(1.1136,'uitslag Toer-S 2023/24 (DH)'),
 # Toer
 'AXEZ':(0.9854,S25),'BAKVIS':(0.8760,S25),'BENEVOLANT':(0.9500,S25),'BIG BANG':(0.9500,S25),'BLACK PEARL':(0.9470,S25),
 'BOBBIE':(0.9750,S25),'BROCKY':(0.8600,S25),'DANAE':(0.9300,S25),'DETOX':(0.8950,S25),'FISSA':(0.8538,S25),
 'GAVIOTA':(0.8250,S25+' (laatste)'),'HABIBI':(0.8450,S25),'KOKKO':(0.8970,S25),'LIVANTO':(0.9200,S25+' (laatste)'),
 'MAC SEA':(0.8350,S25+' (laatste)'),'MANASLU':(0.9650,S25),'ORION':(0.8381,S25),'SERENA':(0.8750,S25),
 'STORMVOGEL II':(0.9613,S25),'SUNSEA':(0.8770,S25),
 'LOOS':(0.9350,'uitslag 2024/25'),'SCALDIS':(0.8691,'uitslag 2024/25'),'WILDE BRAS':(0.8891,'uitslag 2024/25'),
 # ORC (ToT)
 'BLIZZARD OF UZ':(1.0761,S25),'BOERDERIJ':(1.1197,S25),'FARFELU':(1.0207,S25),'OVERRULED':(0.9708,S25),
 'SEATRICKX':(1.1195,S25),'VINDIO':(1.0856,S25),'XTRA SUMMER':(1.1380,S25),'ZEEBEER 3':(1.1096,S25),
 # Multihull: formule GT*100/rating
 'HET VERSTAND VAN POEH':(round(100/134,4),S25+' (rating 134 → ×100/134)'),'TRI4FIVE':(round(100/140,4),S25+' (rating 140 → ×100/140)'),
 'YIPPI YO':(round(100/131,4),S25+' (rating 131 → ×100/131)'),
}
# Schattingen (gemarkeerd, [Inference])
ORC2TS, T2TS = 0.915, 1.066
E = {
 'CAMELOT':(1.0778,'≈ zelfde type: Byron 2 (First 40) Toer-S 2025/26'),
 'JAVA':(0.9080,'≈ zelfde type: Jeronimo (J-70) Toer-S 2025/26'),
 'FF NIKS':(0.9445,'≈ zelfde type: Dekadent (Sun Fast 37) Toer-S 2023/24'),
 'X-POLE':(round(1.0924*ORC2TS,4),'≈ ORC ToT 1,0924 (2025/26) × 0,915'),
 'SJAMAAN':(round(1.0879*ORC2TS,4),'≈ ORC ToT 1,0879 (2024/25) × 0,915'),
 'X-PERIENCE':(round(0.9710*T2TS,4),'≈ Toer 0,9710 (2025/26) × 1,066'),
 'POPEYE':(round(0.8820/T2TS,4),'≈ Toer-S 0,8820 (2025/26) ÷ 1,066'),
 'ZOMERHITTE 2.0':(round(1.0322/T2TS,4),'≈ zelfde type: Dehlicious (Dehler 42) Toer-S ÷ 1,066'),
 'LILITH':(0.9034,'≈ zelfde type: Spur (Bavaria 36) Toer 2025/26'),
 'LIONHEART':(0.8700,'≈ zelfde type: La Mattanza (vd Stad 40) Toer 2024/25'),
}
out={'TS':[],'T':[],'ORC':[],'MH':[]}
for line in L.split('\n'):
    n,t,p,c,note,zn,gc=line.split('|')
    e={'gc':gc,'zn':zn,'boat':n,'type':t,'port':p,'f':None,'src':'geen rating gevonden'}
    if n in R: e['f'],e['src']=R[n]
    elif n in E: e['f'],e['src']=E[n]; e['est']=True
    out[c].append(e)
cnt={k:len(v) for k,v in out.items()}; print(cnt, sum(cnt.values()))
for k,v in out.items(): print(k,'met rating',sum(1 for e in v if e['f'] and not e.get('est')),'schatting',sum(1 for e in v if e.get('est')),'zonder',sum(1 for e in v if not e['f']))
json.dump(out,open('/tmp/claude-0/-home-claude/09957d1d-b54b-5037-9ebe-4041ba2182de/scratchpad/gc/fleet2026.json','w'),ensure_ascii=False,indent=0)
