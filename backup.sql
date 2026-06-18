--
-- PostgreSQL database dump
--

\restrict llVOIHNprWAhqkcLsgdQlCuDnwsYm1tNH9ShgCnnKg1hb0SMkkC2nv9V1SEdj3U

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audio_stories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audio_stories (
    id integer NOT NULL,
    title text NOT NULL,
    category_id integer,
    narrator text DEFAULT ''::text NOT NULL,
    duration_seconds integer DEFAULT 0 NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    thumbnail_url text,
    audio_url text NOT NULL,
    source_type text DEFAULT 'url'::text NOT NULL,
    published boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audio_stories OWNER TO postgres;

--
-- Name: audio_stories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audio_stories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audio_stories_id_seq OWNER TO postgres;

--
-- Name: audio_stories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audio_stories_id_seq OWNED BY public.audio_stories.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name text NOT NULL,
    label text NOT NULL,
    icon text DEFAULT '📁'::text NOT NULL,
    type text DEFAULT 'audio'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: videos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.videos (
    id integer NOT NULL,
    title text NOT NULL,
    category_id integer,
    description text DEFAULT ''::text NOT NULL,
    thumbnail_url text,
    video_url text NOT NULL,
    source_type text DEFAULT 'url'::text NOT NULL,
    youtube_id text,
    views integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.videos OWNER TO postgres;

--
-- Name: videos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.videos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.videos_id_seq OWNER TO postgres;

--
-- Name: videos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.videos_id_seq OWNED BY public.videos.id;


--
-- Name: audio_stories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audio_stories ALTER COLUMN id SET DEFAULT nextval('public.audio_stories_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: videos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.videos ALTER COLUMN id SET DEFAULT nextval('public.videos_id_seq'::regclass);


--
-- Data for Name: audio_stories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audio_stories (id, title, category_id, narrator, duration_seconds, description, thumbnail_url, audio_url, source_type, published, sort_order, created_at, updated_at) FROM stdin;
5	तेनाली रमन ने खोली आदमी की पोल	17	Mahesh	210	राजा कृष्णदेव राय खातिर एगो आदमी रंग-बिरंगा चिड़िया बेचके खुद के बहुत होशियार साबित करे चाहत रहे। लेकिन तेनाली रामन के तेज दिमाग ओकर झूठ पकड़ लिहलस। आखिर कैसे खुलल धोखेबाज आदमी के पोल? देखीं बुद्धि, हास्य अउर मजेदार चाल से भरल ई रोमांचक कहानी। \n	/api/media/files/1779943573050-hp4s1bcpx44.png	/api/media/files/1778907966938-aoxndtmhww7.mp3	upload	t	0	2026-05-16 05:06:51.304322+00	2026-05-28 04:46:47.975+00
7	रामू किसान के मेहनत	10	Mahesh	85	गरीबी अउर सूखा से लड़त रामू किसान कभी हार ना मानेला। गाँव के लोग मजाक उड़ावेला, लेकिन मेहनत अउर भरोसा से ऊ अपना किस्मत बदल देला। ई कहानी सिखावेला कि सच्चा मेहनत करे वाला इंसान के भगवान एक दिन जरूर साथ देलें।	/api/media/files/1779936624211-swle9pjbyb.png	/api/media/files/1779936647935-5pvxgtsustq.mp3	upload	t	2	2026-05-28 02:51:04.716829+00	2026-05-28 02:51:04.716829+00
9	सच्चा प्यार के जीत	14	Mahesh	92	राज अउर पूजा बचपन से एक-दूसरा से प्यार करत रहलें, लेकिन गरीबी अउर समाज दुनो के अलग करे पर तुलल रहे। समय के साथ राज मेहनत करके अपना किस्मत बदल देला। ई कहानी सच्चा प्यार, संघर्ष अउर भरोसा के बा, जहाँ आखिर में प्रेम के जीत होखेला।	/api/media/files/1779940729753-2srxozqbeaz.png	/api/media/files/1779940536920-1lhaxca9a3z.mp3	upload	t	0	2026-05-28 03:59:18.692516+00	2026-05-28 03:59:18.692516+00
8	माई खातिर बेटी के संघर्ष	11	Mahesh	93	गरीबी अउर मजबूरी के बीच एगो बेटी अपना बीमार माई खातिर दिन-रात मेहनत करेले। सिलाई करके ऊ इलाज खातिर पैसा जोड़ेला अउर हर मुश्किल से लड़ जाले। ई भावुक कहानी माई-बेटी के सच्चा प्यार, त्याग अउर संघर्ष के दिल छू लेवे वाला एहसास दिखावेला।	/api/media/files/1779940899276-tu39dzjiccb.png	/api/media/files/1779940264916-ha2o10jjz9.mp3	upload	t	0	2026-05-28 03:51:24.169042+00	2026-05-28 04:02:11.383+00
10	गाँव के गद्दार नौकर	15	Mahesh	128	चंदनपुर गाँव में लाखों के गहना चोरी हो जाला अउर पूरा गाँव डर में डूब जाला। जाँच के दौरान पता चलेला कि चोरी कोई बाहरी ना, बल्कि गाँव के भरोसेमंद नौकर हरि कइले बा। मजबूरी में उठावल गलत कदम ओकर जिंदगी बर्बाद कर देला। ई कहानी भरोसा अउर धोखा के सच्चाई बतावेला।	/api/media/files/1779941278826-n8wttt2ziu.png	/api/media/files/1779941177699-0b1janmiug0v.mp3	upload	t	0	2026-05-28 04:08:06.113964+00	2026-05-28 04:08:06.113964+00
11	मुन्ना बनल अफसर	16	Mahesh	75	गरीबी में पलल मुन्ना रोज कई किलोमीटर पैदल चलके स्कूल जात रहे। लोग ओकर मजाक उड़ावत रहे, लेकिन ऊ हार ना मानलस। लालटेन के रोशनी में पढ़ाई करके आखिरकार ऊ अफसर बन गइल। ई कहानी मेहनत, संघर्ष अउर सपना पूरा करे के हिम्मत देवे वाली प्रेरणादायक कहानी बा।	/api/media/files/1779941748253-ofrtfvc0x8d.png	/api/media/files/1779941650215-afmcfvc7q7f.mp3	upload	t	0	2026-05-28 04:15:56.023733+00	2026-05-28 04:15:56.023733+00
4	पशुपतिनाथ मंदिर 	12	Mahesh	83	नेपाल में स्थित प्रसिद्ध पशुपतिनाथ मंदिर भगवान शिव के सबसे पवित्र धाम में से एक मानल जाला। मान्यता बा कि एह मंदिर में सच्चे मन से पूजा करे वाला भक्त के हर मनोकामना पूरा होला। ई कहानी पशुपतिनाथ धाम के रहस्य, आस्था अउर चमत्कार से जुड़ल अद्भुत यात्रा देखावेला। 🕉️🙏\n	/api/media/files/1779942245751-5k7febbx24u.png	/api/media/files/1778899773397-5qwkfbhubvk.mp3	upload	t	1	2026-05-16 02:50:41.829876+00	2026-05-28 04:28:58.204+00
3	गौरी केदारेश्वर मंदिर	12	Mahesh	77	काशी के केदारघाट पर स्थित गौरी केदारेश्वर मंदिर भगवान शिव के बेहद चमत्कारी धाम मानल जाला। मान्यता बा कि एह मंदिर में दर्शन करे से केदारनाथ धाम से भी कई गुना अधिक पुण्य मिलेला। ई कहानी मंदिर के रहस्य, आस्था अउर अद्भुत चमत्कार के रोमांचक यात्रा देखावेला। 🕉️🔱\n	/api/media/files/1779942977334-wk5knohcv3l.png	/api/media/files/1778765447946-mzwysl1s6j.mp3	upload	t	0	2026-05-14 13:31:05.896963+00	2026-05-28 04:36:22.901+00
2	पीतेश्वर मंदिर	12	Mahesh	84	पीतेश्वर मंदिर भगवान हनुमान के अद्भुत आस्था स्थल मानल जाला, जहाँ 108 टन वजन वाला विशाल हनुमान जी के प्रतिमा स्थापित बा। मान्यता बा कि एह मंदिर में दर्शन करे से संकट दूर होला अउर मनोकामना पूरी हो जाली। ई कहानी मंदिर के चमत्कार, रहस्य अउर भक्ति के अद्भुत अनुभव देखावेला। \n	/api/media/files/1779943307608-09dyo9gx7fyh.png	/api/media/files/1778400831182-b5ot7p3hgdm.mp3	upload	t	0	2026-05-10 08:22:54.245687+00	2026-05-28 04:41:51.976+00
12	Tenali aur baingan	17	श्रोता	0	ee kahani tenali raman ke chuturayee ke bare mein ba	/api/media/files/1780035288156-qhuv94qp0ke.png	/api/media/files/1780035349072-fukgt0dj21.mp3	upload	f	0	2026-05-29 06:16:51.450171+00	2026-05-29 06:16:51.450171+00
13	Peepara wali chudail	9	Mahesh	115	peepara wali chudail	/api/media/files/1780246472744-l9f0681ywg9.png	/api/media/files/1780246488938-pqga7u0nhfm.mp3	upload	t	0	2026-05-31 16:55:20.482425+00	2026-05-31 16:55:20.482425+00
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, label, icon, type, sort_order, active, created_at, updated_at) FROM stdin;
9	horror	भूत-प्रेत	👻	audio	1	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
10	village	गाँव के कहानी	🌾	both	2	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
11	emotional	दिल के बात	💝	both	3	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
12	devotional	भक्ति	🪔	both	4	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
13	mythological	पुरनिया कथा	📖	audio	5	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
14	love	प्रेम कहानी	❤️	audio	6	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
15	crime	क्राइम	🔍	audio	7	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
16	motivation	हिम्मत	⚡	both	8	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
17	kids	लइका के	🧒	audio	9	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
18	comedy	हँसी	😂	video	10	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
19	folk	लोकगीत	🎵	video	11	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
20	drama	नाटक	🎭	video	12	t	2026-05-10 08:30:35.841661+00	2026-05-10 08:30:35.841661+00
\.


--
-- Data for Name: videos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.videos (id, title, category_id, description, thumbnail_url, video_url, source_type, youtube_id, views, published, sort_order, created_at, updated_at) FROM stdin;
4	भारतीय इतिहास	9	भारतीय इतिहास के बारे में जानकारी	\N	https://www.youtube.com/watch?v=0XLGopBovoI	youtube	0XLGopBovoI	0	t	1	2026-06-14 07:10:15.064737+00	2026-06-14 07:10:15.064737+00
5	पीतेश्वर मंदिर कथा	12	पीतेश्वर मंदिर की कथा	\N	https://www.youtube.com/watch?v=Lc8eD9aIyfg	youtube	Lc8eD9aIyfg	0	t	2	2026-06-14 07:10:15.064737+00	2026-06-14 07:10:15.064737+00
6	गाँव के बातें	10	गाँव के बातें और कहानी	\N	https://www.youtube.com/watch?v=dQw4w9WgXcQ	youtube	dQw4w9WgXcQ	0	t	3	2026-06-14 07:10:15.064737+00	2026-06-14 07:10:15.064737+00
\.


--
-- Name: audio_stories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audio_stories_id_seq', 13, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 21, true);


--
-- Name: videos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.videos_id_seq', 6, true);


--
-- Name: audio_stories audio_stories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audio_stories
    ADD CONSTRAINT audio_stories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_unique UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict llVOIHNprWAhqkcLsgdQlCuDnwsYm1tNH9ShgCnnKg1hb0SMkkC2nv9V1SEdj3U

