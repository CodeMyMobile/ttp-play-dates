import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  MapPin,
  Navigation,
  Package,
  Phone,
} from "lucide-react";

const order = {
  id: "0E5752",
  placedMinutesAgo: 19 * 60 + 22,
  customer: {
    name: "Sahil K",
    phone: "(650) 555-5555",
  },
  delivery: {
    street: "510 West 6th Street",
    unit: "Apt 1",
    city: "Los Angeles",
    state: "CA",
    zip: "90014",
    lat: 34.04776,
    lng: -118.2531,
  },
  items: [
    { id: "1", name: "Coppola Pinot Grigio", quantity: 1, price: 18.5 },
    { id: "2", name: "Ice Bucket Rental", quantity: 1, price: 2.5 },
  ],
  fees: [
    { id: "delivery", name: "Delivery Fee", amount: 1.75 },
  ],
  tip: 0,
  notes: "Please call when you're downstairs. Concierge will buzz you in.",
};

const statusTabs = [
  { id: "assigned", label: "Assigned", count: 0 },
  { id: "accepted", label: "Accepted", count: 2 },
  { id: "inProgress", label: "In Progress", count: 1 },
];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const buildAddressLine = (delivery) =>
  `${delivery.street}${delivery.unit ? `, ${delivery.unit}` : ""}, ${delivery.city}, ${delivery.state} ${delivery.zip}`;

const DriverOrders = () => {
  const [activeTab, setActiveTab] = useState("inProgress");
  const [view, setView] = useState("list");

  const mapLinks = useMemo(() => {
    const addressLine = buildAddressLine(order.delivery);
    const encodedAddress = encodeURIComponent(addressLine);
    const latLong = `${order.delivery.lat},${order.delivery.lng}`;

    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
      apple: `http://maps.apple.com/?daddr=${encodedAddress}`,
      waze: `https://waze.com/ul?ll=${encodeURIComponent(latLong)}&navigate=yes`,
    };
  }, []);

  const subtotal = useMemo(
    () => order.items.reduce((total, item) => total + item.price * item.quantity, 0),
    [],
  );

  const totalFees = useMemo(
    () => order.fees.reduce((total, fee) => total + fee.amount, 0),
    [],
  );

  const orderTotal = useMemo(
    () => subtotal + totalFees + order.tip,
    [subtotal, totalFees],
  );

  const minutesToTime = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const renderTabs = () => (
    <div
      className="mb-8 grid grid-cols-3 gap-2 rounded-2xl bg-white/20 p-1 text-sm font-medium text-white"
      role="tablist"
    >
      {statusTabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`flex items-center justify-center gap-1 rounded-xl px-3 py-2 transition ${
              isActive ? "bg-white text-indigo-600 shadow-lg" : "text-white/80"
            }`}
            onClick={() => {
              setActiveTab(tab.id);
              setView("list");
            }}
          >
            <span>{tab.label}</span>
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs">
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderOrderCard = () => (
    <div className="rounded-3xl bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
            Order
          </p>
          <h2 className="text-2xl font-bold text-slate-900">#{order.id}</h2>
        </div>
        <div className="flex flex-col items-end rounded-2xl bg-indigo-50 px-4 py-2 text-right">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
            Time Since Order
          </span>
          <span className="text-lg font-bold text-indigo-600">
            {minutesToTime(order.placedMinutesAgo)}
          </span>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Phone className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">{order.customer.name}</p>
          <a
            href={`tel:${order.customer.phone.replace(/[^\d]/g, "")}`}
            className="text-sm text-indigo-500 hover:text-indigo-600"
          >
            {order.customer.phone}
          </a>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 rounded-full bg-indigo-100 p-2 text-indigo-600">
            <MapPin className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Delivery Address
            </p>
            <p className="text-sm font-medium text-slate-700">
              {order.delivery.street}
            </p>
            {order.delivery.unit && (
              <p className="text-sm text-slate-500">{order.delivery.unit}</p>
            )}
            <p className="text-sm text-slate-500">
              {order.delivery.city}, {order.delivery.state} {order.delivery.zip}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pl-10">
          <a
            href={mapLinks.google}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
          >
            <Navigation className="h-3.5 w-3.5" />
            Google
          </a>
          <a
            href={mapLinks.apple}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
          >
            <Navigation className="h-3.5 w-3.5" />
            Apple
          </a>
          <a
            href={mapLinks.waze}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-200"
          >
            <Navigation className="h-3.5 w-3.5" />
            Waze
          </a>
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-slate-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-slate-500">
          <Package className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Order Items</span>
        </div>
        <ul className="space-y-2 text-sm text-slate-700">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between">
              <span>
                {item.name}
                <span className="text-slate-400"> ×{item.quantity}</span>
              </span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500">Order Total</span>
        <span className="text-xl font-bold text-slate-900">{formatCurrency(orderTotal)}</span>
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700"
        onClick={() => setView("completeDetail")}
      >
        Complete
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  const renderCompletionDetails = () => (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-indigo-600 via-indigo-500 to-purple-500 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <button
          type="button"
          onClick={() => {
            setView("list");
            setActiveTab("inProgress");
          }}
          className="inline-flex items-center gap-2 self-start rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back to In Progress
        </button>

        <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
          <header className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Order Summary
              </p>
              <h1 className="text-3xl font-bold">#{order.id}</h1>
            </div>
            <div className="rounded-2xl bg-black/20 px-4 py-2 text-right">
              <span className="block text-xs font-semibold uppercase tracking-wide text-white/70">
                Time Since Order
              </span>
              <span className="text-lg font-bold">{minutesToTime(order.placedMinutesAgo)}</span>
            </div>
          </header>

          <div className="space-y-6 text-slate-100">
            <section className="rounded-2xl bg-black/20 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/80">
                <Phone className="h-4 w-4" /> Customer
              </h2>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{order.customer.name}</p>
                <a
                  href={`tel:${order.customer.phone.replace(/[^\d]/g, "")}`}
                  className="inline-flex items-center gap-2 text-indigo-100 underline decoration-indigo-200/60 underline-offset-4 hover:text-white"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {order.customer.phone}
                </a>
              </div>
            </section>

            <section className="rounded-2xl bg-black/20 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/80">
                <MapPin className="h-4 w-4" /> Delivery
              </h2>
              <div className="space-y-2 text-sm">
                <p>{order.delivery.street}</p>
                {order.delivery.unit && <p>{order.delivery.unit}</p>}
                <p>
                  {order.delivery.city}, {order.delivery.state} {order.delivery.zip}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <a
                    href={mapLinks.google}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Google Maps
                  </a>
                  <a
                    href={mapLinks.apple}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Apple Maps
                  </a>
                  <a
                    href={mapLinks.waze}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Waze
                  </a>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-black/20 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/80">
                <Package className="h-4 w-4" /> Items
              </h2>
              <ul className="space-y-2 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-white/90">
                    <span>
                      {item.name}
                      <span className="text-white/60"> ×{item.quantity}</span>
                    </span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-black/20 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/80">
                Payment Summary
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-white/80">
                  <dt>Subtotal</dt>
                  <dd>{formatCurrency(subtotal)}</dd>
                </div>
                {order.fees.map((fee) => (
                  <div key={fee.id} className="flex items-center justify-between text-white/80">
                    <dt>{fee.name}</dt>
                    <dd>{formatCurrency(fee.amount)}</dd>
                  </div>
                ))}
                {order.tip > 0 && (
                  <div className="flex items-center justify-between text-white/80">
                    <dt>Tip</dt>
                    <dd>{formatCurrency(order.tip)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-white/20 pt-3 text-base font-semibold text-white">
                  <dt>Total</dt>
                  <dd>{formatCurrency(orderTotal)}</dd>
                </div>
              </dl>
            </section>

            {order.notes && (
              <section className="rounded-2xl bg-black/20 p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/80">
                  Drop-off Notes
                </h2>
                <p className="text-sm text-white/90">{order.notes}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen justify-center bg-gradient-to-b from-indigo-600 via-indigo-500 to-purple-500 px-6 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-center justify-between text-white">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/70">Orders</p>
            <h1 className="text-3xl font-bold">Stay close to the action</h1>
            <p className="text-sm text-white/80">Refresh to stay updated and complete deliveries on time.</p>
          </div>
          <div className="rounded-full bg-black/20 p-3">
            <Clock className="h-5 w-5 text-white" />
          </div>
        </div>

        {view === "list" ? (
          <>
            {renderTabs()}
            {activeTab === "inProgress" ? (
              renderOrderCard()
            ) : (
              <div className="rounded-3xl bg-white/10 p-6 text-center text-white/70">
                No orders in this tab yet.
              </div>
            )}
          </>
        ) : (
          renderCompletionDetails()
        )}
      </div>
    </div>
  );
};

export default DriverOrders;
