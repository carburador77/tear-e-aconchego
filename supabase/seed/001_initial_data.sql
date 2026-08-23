insert into public.categories (name,slug,description,image_url,display_order) values
('Mantas e Peseiras','mantas-e-peseiras','Conforto e elegância para todos os ambientes.','https://images.unsplash.com/photo-1583845112203-454c57d86011?auto=format&fit=crop&w=900&q=85',1),
('Almofadas','almofadas','Texturas que abraçam e transformam seu espaço.','https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=900&q=85',2),
('Colares Decorativos','colares-decorativos','Detalhes que fazem toda a diferença na decoração.','https://images.unsplash.com/photo-1602584386319-4a3b3a7b1c63?auto=format&fit=crop&w=900&q=85',3),
('Cestos e Acessórios','cestos-e-acessorios','Funcionalidade e beleza em peças que organizam.','https://images.unsplash.com/photo-1592066575517-58df903152f2?auto=format&fit=crop&w=900&q=85',4);
insert into public.products (category_id,name,slug,description,price,image_url,origin,dimensions,care,display_order)
select id,'Coberta Lã Natural','coberta-la-natural','Coberta em tons naturais que combina com qualquer ambiente. Conforto e elegância para todos os ambientes da casa.',229,'https://images.unsplash.com/photo-1583845112203-454c57d86011?auto=format&fit=crop&w=1200&q=85','100% fio têxtil natural, feito à mão','Sob encomenda','Lavar à mão em água fria. Secar à sombra.',1 from public.categories where slug='mantas-e-peseiras';
insert into public.products (category_id,name,slug,description,price,image_url,origin,dimensions,care,display_order)
select id,'Manta Tricô Creme','manta-trico-creme','Manta de tricô em fio creme, macia e aconchegante. Perfeita para envolver o sofá ou a cama.',189,'https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=1200&q=85','100% fio têxtil natural, tricô artesanal manual','130 x 170 cm','Lavar à mão em água fria. Secar à sombra na horizontal. Não torcer.',2 from public.categories where slug='mantas-e-peseiras';
insert into public.benefits (icon,title,description,display_order) values
('♡','Produção artesanal','Feito à mão com amor e dedicação',1),('◌','Materiais premium','Selecionamos os melhores materiais para você',2),('▧','Encomendas','Peças personalizadas do seu jeito',3),('♙','Atendimento humanizado','Aqui você é atendido com carinho',4);
insert into public.site_settings (key,value) values
('brand','{"name":"Tear & Aconchego","tagline":"ARTE EM CADA DETALHE","footer":"Tear & Aconchego – Arte em cada detalhe"}'),
('hero','{"title":"Feito à mão. Pensado para acolher.","description":"Peças artesanais que levam beleza, aconchego e personalidade para o seu lar.","buttonText":"CONHEÇA O CATÁLOGO","imageUrl":"https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&q=85"}'),
('contact','{"whatsappUrl":"https://wa.me/5547999999999","phone":"(47) 99999-9999"}'),
('theme','{"forest":"#52604a","cream":"#f5f0e8","sand":"#e7dbca","clay":"#997245"}')
on conflict (key) do update set value=excluded.value, updated_at=now();
