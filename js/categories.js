// Ordered list of groups shown as filter chips.
export const GROUPS = [
  { id: 'food', label: 'Еда и напитки', icon: '🍽️' },
  { id: 'shops', label: 'Магазины', icon: '🛍️' },
  { id: 'beauty', label: 'Красота', icon: '💅' },
  { id: 'health', label: 'Здоровье', icon: '🏥' },
  { id: 'services', label: 'Услуги', icon: '🧰' },
  { id: 'auto', label: 'Авто', icon: '🚗' },
  { id: 'lodging', label: 'Жильё и отели', icon: '🏨' },
  { id: 'leisure', label: 'Досуг и спорт', icon: '🎭' },
  { id: 'education', label: 'Образование', icon: '🎓' },
  { id: 'finance', label: 'Финансы', icon: '💰' },
  { id: 'office', label: 'Офисы и компании', icon: '🏢' },
  { id: 'craft', label: 'Мастерские', icon: '🛠️' },
  { id: 'other', label: 'Прочее', icon: '📍' },
];

// Map from OSM "key=value" to a description.
export const KINDS = {
  // --- food ---
  'amenity=restaurant': { label: 'Ресторан', group: 'food', icon: '🍽️' },
  'amenity=cafe': { label: 'Кафе', group: 'food', icon: '☕' },
  'amenity=fast_food': { label: 'Фастфуд', group: 'food', icon: '🍔' },
  'amenity=bar': { label: 'Бар', group: 'food', icon: '🍸' },
  'amenity=pub': { label: 'Паб', group: 'food', icon: '🍺' },
  'amenity=food_court': { label: 'Фудкорт', group: 'food', icon: '🍱' },
  'amenity=ice_cream': { label: 'Мороженое', group: 'food', icon: '🍦' },
  'amenity=biergarten': { label: 'Пивной сад', group: 'food', icon: '🍻' },
  'shop=bakery': { label: 'Пекарня', group: 'food', icon: '🥖' },
  'shop=pastry': { label: 'Кондитерская', group: 'food', icon: '🥐' },
  'shop=butcher': { label: 'Мясная лавка', group: 'food', icon: '🥩' },
  'shop=greengrocer': { label: 'Овощи и фрукты', group: 'food', icon: '🥬' },
  'shop=seafood': { label: 'Морепродукты', group: 'food', icon: '🦐' },
  'shop=deli': { label: 'Деликатесы', group: 'food', icon: '🧀' },
  'shop=cheese': { label: 'Сырная лавка', group: 'food', icon: '🧀' },
  'shop=chocolate': { label: 'Шоколадная лавка', group: 'food', icon: '🍫' },
  'shop=tea': { label: 'Чайная лавка', group: 'food', icon: '🍵' },
  'shop=wine': { label: 'Винный магазин', group: 'food', icon: '🍷' },
  'shop=alcohol': { label: 'Алкогольный магазин', group: 'food', icon: '🥃' },
  'shop=beverages': { label: 'Напитки', group: 'food', icon: '🥤' },
  'shop=farm': { label: 'Фермерский магазин', group: 'food', icon: '🌾' },
  'shop=health_food': { label: 'Магазин здорового питания', group: 'food', icon: '🥗' },
  'shop=organic': { label: 'Органические продукты', group: 'food', icon: '🌿' },
  'shop=spices': { label: 'Специи', group: 'food', icon: '🌶️' },
  'shop=frozen_food': { label: 'Замороженные продукты', group: 'food', icon: '🧊' },
  'shop=dairy': { label: 'Молочные продукты', group: 'food', icon: '🥛' },

  // --- shops ---
  'shop=supermarket': { label: 'Супермаркет', group: 'shops', icon: '🛒' },
  'shop=convenience': { label: 'Магазин у дома', group: 'shops', icon: '🏪' },
  'shop=kiosk': { label: 'Киоск', group: 'shops', icon: '🧃' },
  'shop=department_store': { label: 'Универмаг', group: 'shops', icon: '🏬' },
  'shop=clothes': { label: 'Одежда', group: 'shops', icon: '👗' },
  'shop=shoes': { label: 'Обувь', group: 'shops', icon: '👟' },
  'shop=boutique': { label: 'Бутик', group: 'shops', icon: '🛍️' },
  'shop=bag': { label: 'Магазин сумок', group: 'shops', icon: '👜' },
  'shop=watches': { label: 'Часы', group: 'shops', icon: '⌚' },
  'shop=jewelry': { label: 'Ювелирный магазин', group: 'shops', icon: '💍' },
  'shop=fabric': { label: 'Ткани', group: 'shops', icon: '🧵' },
  'shop=second_hand': { label: 'Секонд-хенд', group: 'shops', icon: '🧥' },
  'shop=sports': { label: 'Спорттовары', group: 'shops', icon: '🏀' },
  'shop=outdoor': { label: 'Туристические товары', group: 'shops', icon: '🏕️' },
  'shop=bicycle': { label: 'Велосипеды', group: 'shops', icon: '🚲' },
  'shop=books': { label: 'Книжный магазин', group: 'shops', icon: '📚' },
  'shop=stationery': { label: 'Канцтовары', group: 'shops', icon: '🖊️' },
  'shop=gift': { label: 'Подарки', group: 'shops', icon: '🎁' },
  'shop=toys': { label: 'Игрушки', group: 'shops', icon: '🧸' },
  'shop=art': { label: 'Художественные товары', group: 'shops', icon: '🎨' },
  'shop=musical_instrument': { label: 'Музыкальные инструменты', group: 'shops', icon: '🎸' },
  'shop=video_games': { label: 'Игры', group: 'shops', icon: '🎮' },
  'shop=electronics': { label: 'Электроника', group: 'shops', icon: '💻' },
  'shop=mobile_phone': { label: 'Телефоны', group: 'shops', icon: '📱' },
  'shop=computer': { label: 'Компьютеры', group: 'shops', icon: '🖥️' },
  'shop=appliance': { label: 'Бытовая техника', group: 'shops', icon: '🔌' },
  'shop=furniture': { label: 'Мебель', group: 'shops', icon: '🛋️' },
  'shop=houseware': { label: 'Товары для дома', group: 'shops', icon: '🍳' },
  'shop=lighting': { label: 'Светильники', group: 'shops', icon: '💡' },
  'shop=bathroom_furnishing': { label: 'Сантехника', group: 'shops', icon: '🚿' },
  'shop=paint': { label: 'Лакокрасочные материалы', group: 'shops', icon: '🖌️' },
  'shop=hardware': { label: 'Хозтовары', group: 'shops', icon: '🔨' },
  'shop=doityourself': { label: 'Строительный магазин', group: 'shops', icon: '🪛' },
  'shop=garden_centre': { label: 'Садовый центр', group: 'shops', icon: '🌱' },
  'shop=florist': { label: 'Цветы', group: 'shops', icon: '💐' },
  'shop=pet': { label: 'Зоомагазин', group: 'shops', icon: '🐾' },
  'shop=photo': { label: 'Фототовары', group: 'shops', icon: '📷' },
  'shop=tobacco': { label: 'Табачный магазин', group: 'shops', icon: '🚬' },
  'shop=newsagent': { label: 'Газеты и журналы', group: 'shops', icon: '📰' },
  'shop=wholesale': { label: 'Оптовый склад', group: 'shops', icon: '📦' },
  'amenity=marketplace': { label: 'Рынок', group: 'shops', icon: '🧺' },

  // --- beauty ---
  'shop=hairdresser': { label: 'Парикмахерская', group: 'beauty', icon: '💇' },
  'shop=beauty': { label: 'Салон красоты', group: 'beauty', icon: '💅' },
  'shop=cosmetics': { label: 'Косметика', group: 'beauty', icon: '💄' },
  'shop=perfumery': { label: 'Парфюмерия', group: 'beauty', icon: '🌸' },
  'shop=massage': { label: 'Массажный салон', group: 'beauty', icon: '💆' },
  'shop=tattoo': { label: 'Тату-салон', group: 'beauty', icon: '🖋️' },
  'shop=hairdresser_supply': { label: 'Товары для парикмахеров', group: 'beauty', icon: '💈' },

  // --- health ---
  'amenity=pharmacy': { label: 'Аптека', group: 'health', icon: '💊' },
  'amenity=dentist': { label: 'Стоматология', group: 'health', icon: '🦷' },
  'amenity=clinic': { label: 'Клиника', group: 'health', icon: '🏥' },
  'amenity=doctors': { label: 'Медицинский центр', group: 'health', icon: '🩺' },
  'amenity=veterinary': { label: 'Ветеринарная клиника', group: 'health', icon: '🐶' },
  'healthcare=laboratory': { label: 'Медицинская лаборатория', group: 'health', icon: '🧪' },
  'healthcare=physiotherapist': { label: 'Физиотерапия', group: 'health', icon: '🦴' },
  'healthcare=optometrist': { label: 'Оптометрист', group: 'health', icon: '👁️' },
  'healthcare=psychotherapist': { label: 'Психотерапия', group: 'health', icon: '🧠' },
  'healthcare=alternative': { label: 'Альтернативная медицина', group: 'health', icon: '🌿' },
  'healthcare=podiatrist': { label: 'Подолог', group: 'health', icon: '🦶' },
  'healthcare=speech_therapist': { label: 'Логопед', group: 'health', icon: '🗣️' },
  'healthcare=dietitian': { label: 'Диетолог', group: 'health', icon: '🥗' },
  'healthcare=midwife': { label: 'Акушерская помощь', group: 'health', icon: '🤰' },
  'shop=optician': { label: 'Оптика', group: 'health', icon: '👓' },
  'shop=medical_supply': { label: 'Медтовары', group: 'health', icon: '🩹' },
  'shop=hearing_aids': { label: 'Слуховые аппараты', group: 'health', icon: '👂' },
  'shop=nutrition_supplements': { label: 'Спортивное питание', group: 'health', icon: '💪' },
  'shop=chemist': { label: 'Дрогерия', group: 'health', icon: '🧴' },

  // --- services ---
  'amenity=laundry': { label: 'Прачечная', group: 'services', icon: '🧺' },
  'amenity=photo_booth': { label: 'Фотобудка', group: 'services', icon: '📸' },
  'amenity=animal_boarding': { label: 'Передержка животных', group: 'services', icon: '🐕' },
  'shop=laundry': { label: 'Прачечная-услуги', group: 'services', icon: '🧺' },
  'shop=dry_cleaning': { label: 'Химчистка', group: 'services', icon: '🧼' },
  'shop=shoe_repair': { label: 'Ремонт обуви', group: 'services', icon: '👞' },
  'shop=funeral_directors': { label: 'Ритуальные услуги', group: 'services', icon: '⚱️' },
  'shop=copyshop': { label: 'Копицентр', group: 'services', icon: '🖨️' },
  'shop=travel_agency': { label: 'Турагентство', group: 'services', icon: '✈️' },
  'shop=pet_grooming': { label: 'Груминг', group: 'services', icon: '🐩' },

  // --- auto ---
  'amenity=car_wash': { label: 'Автомойка', group: 'auto', icon: '🚿' },
  'amenity=car_rental': { label: 'Прокат автомобилей', group: 'auto', icon: '🚙' },
  'amenity=fuel': { label: 'АЗС', group: 'auto', icon: '⛽' },
  'amenity=vehicle_inspection': { label: 'Техосмотр', group: 'auto', icon: '🔍' },
  'shop=car': { label: 'Автосалон', group: 'auto', icon: '🚗' },
  'shop=car_repair': { label: 'Автосервис', group: 'auto', icon: '🔧' },
  'shop=car_parts': { label: 'Автозапчасти', group: 'auto', icon: '⚙️' },
  'shop=tyres': { label: 'Шиномонтаж', group: 'auto', icon: '🛞' },
  'shop=motorcycle': { label: 'Мотосалон', group: 'auto', icon: '🏍️' },
  'shop=motorcycle_repair': { label: 'Мотосервис', group: 'auto', icon: '🛵' },

  // --- lodging ---
  'tourism=hotel': { label: 'Гостиница', group: 'lodging', icon: '🏨' },
  'tourism=hostel': { label: 'Хостел', group: 'lodging', icon: '🛏️' },
  'tourism=guest_house': { label: 'Гостевой дом', group: 'lodging', icon: '🏡' },
  'tourism=motel': { label: 'Мотель', group: 'lodging', icon: '🛣️' },
  'tourism=apartment': { label: 'Апартаменты', group: 'lodging', icon: '🏠' },
  'tourism=chalet': { label: 'Шале', group: 'lodging', icon: '🏘️' },
  'tourism=camp_site': { label: 'Кемпинг', group: 'lodging', icon: '🏕️' },
  'tourism=caravan_site': { label: 'Кемпинг для автодомов', group: 'lodging', icon: '🚐' },
  'tourism=bed_and_breakfast': { label: 'Мини-отель', group: 'lodging', icon: '🛌' },

  // --- leisure ---
  'amenity=nightclub': { label: 'Ночной клуб', group: 'leisure', icon: '🪩' },
  'amenity=casino': { label: 'Казино', group: 'leisure', icon: '🎰' },
  'amenity=cinema': { label: 'Кинотеатр', group: 'leisure', icon: '🎬' },
  'amenity=theatre': { label: 'Театр', group: 'leisure', icon: '🎭' },
  'amenity=arts_centre': { label: 'Арт-центр', group: 'leisure', icon: '🎨' },
  'amenity=events_venue': { label: 'Площадка для мероприятий', group: 'leisure', icon: '🎪' },
  'amenity=internet_cafe': { label: 'Интернет-кафе', group: 'leisure', icon: '🌐' },
  'amenity=studio': { label: 'Студия', group: 'leisure', icon: '🎙️' },
  'amenity=hookah_lounge': { label: 'Кальянная', group: 'leisure', icon: '💨' },
  'amenity=karaoke_box': { label: 'Караоке', group: 'leisure', icon: '🎤' },
  'amenity=boat_rental': { label: 'Прокат лодок', group: 'leisure', icon: '🚣' },
  'tourism=museum': { label: 'Музей', group: 'leisure', icon: '🏛️' },
  'tourism=gallery': { label: 'Галерея', group: 'leisure', icon: '🖼️' },
  'tourism=aquarium': { label: 'Аквариум', group: 'leisure', icon: '🐠' },
  'tourism=theme_park': { label: 'Парк развлечений', group: 'leisure', icon: '🎢' },
  'leisure=fitness_centre': { label: 'Фитнес-центр', group: 'leisure', icon: '🏋️' },
  'leisure=sports_centre': { label: 'Спорткомплекс', group: 'leisure', icon: '🏟️' },
  'leisure=dance': { label: 'Танцевальная студия', group: 'leisure', icon: '💃' },
  'leisure=bowling_alley': { label: 'Боулинг', group: 'leisure', icon: '🎳' },
  'leisure=escape_game': { label: 'Квест-комната', group: 'leisure', icon: '🔐' },
  'leisure=amusement_arcade': { label: 'Игровые автоматы', group: 'leisure', icon: '🕹️' },
  'leisure=adult_gaming_centre': { label: 'Игровой клуб', group: 'leisure', icon: '🎲' },
  'leisure=sauna': { label: 'Сауна', group: 'leisure', icon: '🧖' },
  'leisure=water_park': { label: 'Аквапарк', group: 'leisure', icon: '🌊' },
  'leisure=swimming_pool': { label: 'Бассейн', group: 'leisure', icon: '🏊' },
  'leisure=miniature_golf': { label: 'Мини-гольф', group: 'leisure', icon: '⛳' },
  'leisure=golf_course': { label: 'Гольф-клуб', group: 'leisure', icon: '🏌️' },
  'leisure=trampoline_park': { label: 'Батутный парк', group: 'leisure', icon: '🤸' },
  'leisure=ice_rink': { label: 'Каток', group: 'leisure', icon: '⛸️' },
  'leisure=horse_riding': { label: 'Конный клуб', group: 'leisure', icon: '🐴' },
  'leisure=tanning_salon': { label: 'Солярий', group: 'leisure', icon: '🌞' },
  'leisure=hackerspace': { label: 'Хакерспейс', group: 'leisure', icon: '💻' },
  'leisure=marina': { label: 'Марина', group: 'leisure', icon: '🛥️' },
  'shop=scuba_diving': { label: 'Дайвинг-центр', group: 'leisure', icon: '🤿' },
  'shop=fishing': { label: 'Рыболовные товары', group: 'leisure', icon: '🎣' },

  // --- education ---
  'amenity=driving_school': { label: 'Автошкола', group: 'education', icon: '🚗' },
  'amenity=language_school': { label: 'Языковая школа', group: 'education', icon: '🗣️' },
  'amenity=music_school': { label: 'Музыкальная школа', group: 'education', icon: '🎼' },
  'amenity=dancing_school': { label: 'Школа танцев', group: 'education', icon: '🩰' },
  'amenity=prep_school': { label: 'Курсы подготовки', group: 'education', icon: '📝' },
  'amenity=childcare': { label: 'Детский центр', group: 'education', icon: '🧸' },

  // --- finance ---
  'amenity=bank': { label: 'Банк', group: 'finance', icon: '🏦' },
  'amenity=bureau_de_change': { label: 'Обмен валют', group: 'finance', icon: '💱' },
  'amenity=money_transfer': { label: 'Денежные переводы', group: 'finance', icon: '💸' },
  'amenity=payday_loan': { label: 'Микрозаймы', group: 'finance', icon: '💵' },
  'office=financial': { label: 'Финансовая компания', group: 'finance', icon: '💼' },
  'office=insurance': { label: 'Страховая компания', group: 'finance', icon: '🛡️' },
  'shop=pawnbroker': { label: 'Ломбард', group: 'finance', icon: '💰' },

  // --- office ---
  'amenity=coworking_space': { label: 'Коворкинг', group: 'office', icon: '🏢' },
  'office=lawyer': { label: 'Юридическая фирма', group: 'office', icon: '⚖️' },
  'office=notary': { label: 'Нотариус', group: 'office', icon: '📜' },
  'office=accountant': { label: 'Бухгалтерская компания', group: 'office', icon: '🧮' },
  'office=estate_agent': { label: 'Агентство недвижимости', group: 'office', icon: '🏘️' },
  'office=it': { label: 'IT-компания', group: 'office', icon: '💻' },
  'office=company': { label: 'Компания', group: 'office', icon: '🏢' },
  'office=advertising_agency': { label: 'Рекламное агентство', group: 'office', icon: '📣' },
  'office=architect': { label: 'Архитектурное бюро', group: 'office', icon: '📐' },
  'office=travel_agent': { label: 'Туроператор', group: 'office', icon: '🧳' },
  'office=tax_advisor': { label: 'Налоговый консультант', group: 'office', icon: '🧾' },
  'office=employment_agency': { label: 'Кадровое агентство', group: 'office', icon: '👔' },
  'office=logistics': { label: 'Логистическая компания', group: 'office', icon: '🚚' },
  'office=research': { label: 'Исследовательская компания', group: 'office', icon: '🔬' },
  'office=consulting': { label: 'Консалтинговая компания', group: 'office', icon: '🧑‍💼' },
  'office=graphic_design': { label: 'Дизайн-студия', group: 'office', icon: '🎨' },
  'office=telecommunication': { label: 'Телеком-компания', group: 'office', icon: '📡' },

  // --- craft ---
  'craft=shoemaker': { label: 'Сапожная мастерская', group: 'craft', icon: '👞' },
  'craft=tailor': { label: 'Ателье', group: 'craft', icon: '✂️' },
  'craft=dressmaker': { label: 'Швейная мастерская', group: 'craft', icon: '🧵' },
  'craft=photographer': { label: 'Фотограф', group: 'craft', icon: '📸' },
  'craft=carpenter': { label: 'Столярная мастерская', group: 'craft', icon: '🪚' },
  'craft=electrician': { label: 'Электрик', group: 'craft', icon: '⚡' },
  'craft=plumber': { label: 'Сантехник', group: 'craft', icon: '🔧' },
  'craft=jeweller': { label: 'Ювелирная мастерская', group: 'craft', icon: '💎' },
  'craft=key_cutter': { label: 'Изготовление ключей', group: 'craft', icon: '🔑' },
  'craft=locksmith': { label: 'Слесарная мастерская', group: 'craft', icon: '🔩' },
  'craft=watchmaker': { label: 'Часовая мастерская', group: 'craft', icon: '⌚' },
  'craft=brewery': { label: 'Пивоварня', group: 'craft', icon: '🍺' },
  'craft=confectionery': { label: 'Кондитерская ручной работы', group: 'craft', icon: '🧁' },
  'craft=winery': { label: 'Винодельня', group: 'craft', icon: '🍷' },
  'craft=distillery': { label: 'Винокурня', group: 'craft', icon: '🥃' },
  'craft=caterer': { label: 'Кейтеринг', group: 'craft', icon: '🍱' },
  'craft=bookbinder': { label: 'Переплётная мастерская', group: 'craft', icon: '📖' },
  'craft=glaziery': { label: 'Стекольная мастерская', group: 'craft', icon: '🪟' },
  'craft=painter': { label: 'Маляр', group: 'craft', icon: '🎨' },
  'craft=upholsterer': { label: 'Обивка мебели', group: 'craft', icon: '🛋️' },
  'craft=roofer': { label: 'Кровельщик', group: 'craft', icon: '🏠' },
  'craft=stonemason': { label: 'Каменщик', group: 'craft', icon: '🪨' },
  'craft=window_construction': { label: 'Окна и двери', group: 'craft', icon: '🪟' },
  'craft=hvac': { label: 'Вентиляция и кондиционеры', group: 'craft', icon: '🌡️' },
  'craft=handicraft': { label: 'Ремесленная мастерская', group: 'craft', icon: '🧶' },
  'craft=sawmill': { label: 'Лесопилка', group: 'craft', icon: '🪵' },
  'craft=metal_construction': { label: 'Металлоконструкции', group: 'craft', icon: '🔩' },
};

// Fallback rules for unknown values of broad keys.
const FALLBACK_BY_KEY = {
  shop: { label: 'Магазин', group: 'shops', icon: '🛍️' },
  craft: { label: 'Мастерская', group: 'craft', icon: '🛠️' },
  office: { label: 'Офис', group: 'office', icon: '🏢' },
};

const DEFAULT_KIND = { label: 'Заведение', group: 'other', icon: '📍' };

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// classify('amenity=cafe') -> { kind:'amenity=cafe', label:'Кафе', group:'food', icon:'☕' }
// Never throws; unknown kinds fall back by key (see FALLBACK_BY_KEY) or to 'other'.
export function classify(kind) {
  const key = typeof kind === 'string' ? kind.trim() : '';

  if (key && hasOwn(KINDS, key)) {
    const { label, group, icon } = KINDS[key];
    return { kind: key, label, group, icon };
  }

  const match = /^([a-z]+)=(.+)$/.exec(key);
  if (match && hasOwn(FALLBACK_BY_KEY, match[1])) {
    const { label, group, icon } = FALLBACK_BY_KEY[match[1]];
    return { kind: key, label, group, icon };
  }

  const { label, group, icon } = DEFAULT_KIND;
  return { kind: key, label, group, icon };
}

// groupById('food') -> the group object, or the 'other' group if unknown.
export function groupById(id) {
  return GROUPS.find((g) => g.id === id) ?? GROUPS.find((g) => g.id === 'other');
}
