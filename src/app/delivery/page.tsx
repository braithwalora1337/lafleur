import Link from "next/link";

export const metadata = { title: "Доставка по Режу — LaFleur", description: "Условия и стоимость доставки букетов LaFleur по Режу" };

export default function DeliveryPage() {
  return <main className="delivery-page">
    <section className="delivery-photo-page">
      <header className="delivery-photo-head"><Link className="brand" href="/">LA<span>FLEUR</span></Link><Link className="delivery-back" href="/">← На главную</Link></header>
      <div className="delivery-photo-content">
        <div className="delivery-photo-copy"><span className="eyebrow">Доставка и забота · Реж</span><h1>Ваши чувства<br />приедут вовремя</h1><p>Бережно упакуем букет, пришлём фотографию перед отправкой и согласуем удобное время по телефону.</p><div className="free-delivery"><small>При заказе от</small><strong>5 000 ₽</strong><span>доставка бесплатно</span></div></div>
        <aside className="delivery-price-panel"><span className="eyebrow">Стоимость доставки</span><h2>Реж и районы</h2><ul className="delivery-rates"><li><b>Гавань</b><strong>250 ₽</strong></li><li><b>7 В</b><strong>250 ₽</strong></li><li><b>6 участок</b><strong>330 ₽</strong></li><li><b>Кочнево</b><strong>250 ₽</strong></li></ul><p>Точное время и адрес подтвердим звонком после оформления заказа.</p><Link className="button light" href="/#catalog">Выбрать букет</Link></aside>
      </div>
    </section>
  </main>;
}
