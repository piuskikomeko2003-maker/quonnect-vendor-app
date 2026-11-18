"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addCustomerAction } from "@/actions/business";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { MoneyText } from "@/components/ui/MoneyText";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { formatNumber, initials } from "@/lib/format";
import { isValidEmail, isValidPhone } from "@/lib/validation";
import type { Customer } from "@/types/app-db";

export function CustomersScreen({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const search = query.trim().toLowerCase();
  const list = useMemo(
    () =>
      customers.filter(
        (customer) =>
          !search ||
          customer.name.toLowerCase().includes(search) ||
          (customer.phone ?? "").toLowerCase().includes(search) ||
          (customer.email ?? "").toLowerCase().includes(search),
      ),
    [customers, search],
  );

  const totalSpent = customers.reduce((total, customer) => total + Number(customer.total_spent), 0);
  const totalOrders = customers.reduce((total, customer) => total + Number(customer.total_orders), 0);

  function openAdd() {
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setError("");
    setAddOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      setError("Enter a customer name");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Enter a valid phone number, or leave it blank");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address, or leave it blank");
      return;
    }
    setBusy(true);
    const result = await addCustomerAction({ name, phone, email, address, notes });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save customer");
      return;
    }
    setAddOpen(false);
    toast("Customer added");
    router.refresh();
  }

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Customers</span>
          <strong className="stat-value">{formatNumber(customers.length)}</strong>
          <span className="stat-unit">total customers</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Customer spend</span>
          <MoneyText className="stat-value" amount={totalSpent} currency={false} />
          <span className="stat-unit">UGX · all time</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Orders</span>
          <strong className="stat-value">{formatNumber(totalOrders)}</strong>
          <span className="stat-unit">linked orders</span>
        </div>
        <button type="button" className="stat-card add-customer-card" onClick={openAdd}>
          <span className="quick-action-icon">
            <Icon name="plus" size={22} />
          </span>
          <strong className="stat-value">Add customer</strong>
          <span className="stat-unit">Name, contact and notes</span>
        </button>
      </div>

      <div className="customers-toolbar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search customers"
          aria-label="Search customers"
        />
      </div>

      {list.length ? (
        <div className="surface" style={{ paddingTop: 6, paddingBottom: 6 }}>
          {list.map((customer) => (
            <div className="customer-row" key={customer.id}>
              <span className="customer-avatar">{initials(customer.name)}</span>
              <div className="grow">
                <b>{customer.name}</b>
                <small>
                  {[customer.phone, customer.email].filter(Boolean).join(" · ") ||
                    "No contact added"}
                </small>
                {customer.address ? <small>{customer.address}</small> : null}
              </div>
              <div className="customer-stats">
                <MoneyText amount={customer.total_spent} fit={false} />
                <small>
                  {customer.total_orders} order{customer.total_orders === 1 ? "" : "s"}
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="surface">
          <div className="empty-state">
            <span className="icon-circle solid">
              <Icon name="user" size={22} />
            </span>
            <b>{customers.length ? "No customers match your search" : "No customers yet"}</b>
            <small>
              {customers.length
                ? "Try a different name or phone number."
                : "Add a customer here, or add one while recording a sale."}
            </small>
            {!customers.length ? (
              <button type="button" className="btn" onClick={openAdd}>
                Add your first customer
              </button>
            ) : null}
          </div>
        </div>
      )}

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add customer">
        <label htmlFor="c-name">Customer name</label>
        <input
          id="c-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="e.g. Sarah Nakato"
        />
        <label htmlFor="c-phone">Phone / WhatsApp (optional)</label>
        <input
          id="c-phone"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+256 7XX XXX XXX"
        />
        <label htmlFor="c-email">Email (optional)</label>
        <input
          id="c-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="customer@example.com"
        />
        <label htmlFor="c-address">Address / location (optional)</label>
        <input
          id="c-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="e.g. Owino Market"
        />
        <label htmlFor="c-notes">Notes (optional)</label>
        <textarea
          id="c-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Sizes, preferences, anything useful"
        />
        <div className="err" role="alert">
          {error}
        </div>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 6 }}
          onClick={save}
          disabled={busy}
          aria-busy={busy ? "true" : undefined}
        >
          {busy ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            "Save customer"
          )}
        </button>
      </BottomSheet>
    </>
  );
}
