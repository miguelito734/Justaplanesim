export type Category = 'Leves' | 'Médias' | 'Pesadas' | 'Carga' | 'Militares' | 'Outras';
export type Aircraft = { id: string; name: string; maker: string; category: Category; length: number; span: number; mass: number; fuel: number; seats: number; stall: number; cruise: number; max: number; thrust: number; engines: number; shape: 'light'|'jet'|'jumbo'|'beluga'|'fighter'|'prop'|'glider'|'balloon'|'airship'|'paramotor'; color: string; status: 'Física básica'|'Modelo visual'; license: string };
const make = (id:string,name:string,maker:string,category:Category,length:number,span:number,mass:number,fuel:number,seats:number,stall:number,cruise:number,max:number,thrust:number,engines:number,shape:Aircraft['shape'],color='#c34640'):Aircraft => ({id,name,maker,category,length,span,mass,fuel,seats,stall,cruise,max,thrust,engines,shape,color,status:['balloon','airship','paramotor','glider'].includes(shape)?'Modelo visual':'Física básica',license:category==='Leves'?'PP':category==='Militares'?'Qualificação militar':'PLA + habilitação de tipo'});
export const aircraft: Aircraft[] = [
make('c152','Cessna 152','Cessna','Leves',7,10.2,757,100,2,43,107,126,1800,1,'light','#d34c42'),
make('sr22','Cirrus SR22','Cirrus','Leves',7.9,11.7,1542,310,4,60,180,200,3600,1,'light','#4284a0'),
make('g36','Bonanza G36','Beechcraft','Leves',8.4,10.2,1656,280,6,61,176,205,3600,1,'light','#d29b47'),
make('pa28','Piper PA-28','Piper','Leves',7.3,10.8,1157,180,4,50,123,154,2200,1,'light','#639d82'),
make('a320','Airbus A320','Airbus','Médias',37.6,35.8,66000,21000,180,118,450,490,240000,2,'jet','#4a82ac'),
make('b737','Boeing 737','Boeing','Médias',39.5,35.8,65000,20800,189,122,450,490,242000,2,'jet','#cf6451'),
make('e195','Embraer E195-E2','Embraer','Médias',41.5,35.1,52000,13500,146,110,450,480,200000,2,'jet','#59a38c'),
make('md11','McDonnell Douglas MD-11','McDonnell Douglas','Médias',61.2,51.7,220000,117000,293,145,480,510,819000,3,'jet','#9986b8'),
make('b777','Boeing 777-300ER','Boeing','Pesadas',73.9,64.8,300000,145000,396,145,490,515,1026000,2,'jet','#c05b53'),
make('b748','Boeing 747-8','Boeing','Pesadas',76.3,68.4,360000,190000,467,150,490,530,1184000,4,'jumbo','#4a87a1'),
make('a380','Airbus A380','Airbus','Pesadas',72.7,79.8,480000,250000,555,150,490,530,1240000,4,'jumbo','#759baf'),
make('a350','Airbus A350-1000','Airbus','Pesadas',73.8,64.8,270000,125000,410,140,490,520,864000,2,'jet','#bd8f49'),
make('beluga','Airbus BelugaXL','Airbus','Carga',63.1,60.3,190000,75000,0,125,400,450,632000,2,'beluga','#65a2c4'),
make('md11f','McDonnell Douglas MD-11F','McDonnell Douglas','Carga',61.2,51.7,230000,117000,0,150,480,510,819000,3,'jet','#b5894d'),
make('b744f','Boeing 747-400F','Boeing','Carga',70.7,64.4,340000,173000,0,155,490,520,1120000,4,'jumbo','#8d85ad'),
make('b757f','Boeing 757-200F','Boeing','Carga',47.3,38,100000,34000,0,128,450,490,356000,2,'jet','#c3a14c'),
make('c130','Lockheed C-130 Hercules','Lockheed','Militares',29.8,40.4,60000,26000,92,100,290,320,220000,4,'prop','#718775'),
make('f22','Lockheed Martin F-22 Raptor','Lockheed Martin','Militares',18.9,13.6,26000,8200,1,130,1000,1200,312000,2,'fighter','#8b9c9d'),
make('balloon','Balão de ar quente','Experimental','Outras',12,18,700,80,4,0,8,15,0,0,'balloon','#da8f46'),
make('ask21','Planador Schleicher ASK 21','Schleicher','Outras',8.35,17,500,0,2,35,90,151,0,0,'glider','#e1a751'),
make('paramotor','Paramotor','Experimental','Outras',2,10,150,12,1,15,25,40,500,1,'paramotor','#df7962'),
make('airship','Dirigível','Experimental','Outras',75,20,8000,2000,12,0,40,65,15000,2,'airship','#a6bcb8'),
];
export function validateAircraft(a:Aircraft) { if(!a.id || a.mass<=0 || a.length<=0 || a.span<=0 || a.max<a.cruise || a.cruise<a.stall || a.engines<0) throw new Error(`Configuração inválida: ${a.id}`); }
aircraft.forEach(validateAircraft);
export const categories: Category[] = ['Leves','Médias','Pesadas','Carga','Militares','Outras'];
