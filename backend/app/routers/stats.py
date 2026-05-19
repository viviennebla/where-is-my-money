from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, extract, Integer, String, cast as sa_cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.transaction import Transaction, TransactionType
from app.models.account import Account
from app.schemas.stats import (
    StatSummary, MonthlyTrendItem, TrendItem, CalendarDay,
    CategoryItem, MerchantItem, AccountBalanceItem,
)

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])

THIS_YEAR = date.today().year
THIS_MONTH = date.today().month


@router.get("/summary", response_model=StatSummary)
async def get_summary(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
):
    query = select(
        func.sum(case(
            (Transaction.type == TransactionType.EXPENSE, Transaction.base_amount),
            else_=0,
        )),
        func.sum(case(
            (Transaction.type == TransactionType.INCOME, Transaction.base_amount),
            (Transaction.type == TransactionType.REFUND, Transaction.base_amount),
            else_=0,
        )),
        func.count(),
    ).where(Transaction.user_id == user_id)

    if year is not None:
        query = query.where(extract("year", Transaction.transaction_date) == year)
    if month is not None:
        query = query.where(extract("month", Transaction.transaction_date) == month)

    result = await db.execute(query)
    row = result.one()
    expense = row[0] or Decimal("0")
    income = row[1] or Decimal("0")
    net = income - expense
    tx_count = row[2]

    assets_result = await db.execute(
        select(func.sum(Account.current_balance)).where(
            Account.user_id == user_id,
            Account.is_active == True,
        )
    )
    total_assets = assets_result.scalar() or Decimal("0")

    return StatSummary(expense=expense, income=income, net=net, tx_count=tx_count, total_assets=total_assets)


@router.get("/monthly-trend", response_model=list[MonthlyTrendItem])
async def get_monthly_trend(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    months: int = Query(default=6, ge=1, le=60),
):
    subq = (
        select(
            extract("year", Transaction.transaction_date).label("y"),
            extract("month", Transaction.transaction_date).label("m"),
            func.sum(case(
                (Transaction.type == TransactionType.EXPENSE, Transaction.base_amount),
                else_=0,
            )).label("expense"),
            func.sum(case(
                (Transaction.type == TransactionType.INCOME, Transaction.base_amount),
                (Transaction.type == TransactionType.REFUND, Transaction.base_amount),
                else_=0,
            )).label("income"),
        )
        .where(Transaction.user_id == user_id)
        .group_by("y", "m")
        .order_by("y", "m")
        .limit(months)
    )

    # SQLite doesn't support selecting from a subquery with ORDER BY + LIMIT easily,
    # so we sort in descending order first to get the most recent N months, then sort ascending in Python
    desc_query = (
        select(
            extract("year", Transaction.transaction_date).label("y"),
            extract("month", Transaction.transaction_date).label("m"),
            func.sum(case(
                (Transaction.type == TransactionType.EXPENSE, Transaction.base_amount),
                else_=0,
            )).label("expense"),
            func.sum(case(
                (Transaction.type == TransactionType.INCOME, Transaction.base_amount),
                (Transaction.type == TransactionType.REFUND, Transaction.base_amount),
                else_=0,
            )).label("income"),
        )
        .where(Transaction.user_id == user_id)
        .group_by("y", "m")
        .order_by("y", "m")
    )

    result = await db.execute(desc_query)
    all_rows = result.all()
    recent = all_rows[-months:] if len(all_rows) > months else all_rows

    return [
        MonthlyTrendItem(
            year=int(row[0]),
            month=int(row[1]),
            expense=row[2] or Decimal("0"),
            income=row[3] or Decimal("0"),
        )
        for row in recent
    ]


@router.get("/trend", response_model=list[TrendItem])
async def get_trend(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    granularity: str = Query(default="month", pattern="^(day|week|month|quarter|year)$"),
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    months: int = Query(default=12, ge=1, le=60),
):
    if granularity == "day":
        if year is None or month is None:
            year, month = THIS_YEAR, THIS_MONTH
        period_expr = func.strftime("%Y-%m-%d", Transaction.transaction_date)
        filter_expr = (extract("year", Transaction.transaction_date) == year) & (extract("month", Transaction.transaction_date) == month)
        order_expr = period_expr
    elif granularity == "week":
        if year is None:
            year = THIS_YEAR
        period_expr = func.strftime("%Y", Transaction.transaction_date) + "-W" + func.strftime("%W", Transaction.transaction_date)
        filter_expr = extract("year", Transaction.transaction_date) == year
        if month is not None:
            filter_expr = filter_expr & (extract("month", Transaction.transaction_date) == month)
        order_expr = period_expr
    elif granularity == "quarter":
        if year is None:
            year = THIS_YEAR
        period_expr = func.strftime("%Y", Transaction.transaction_date) + "-Q" + sa_cast((sa_cast(func.strftime("%m", Transaction.transaction_date), Integer) + 2) / 3, String)
        filter_expr = extract("year", Transaction.transaction_date) == year
        order_expr = period_expr
    elif granularity == "year":
        period_expr = func.strftime("%Y", Transaction.transaction_date)
        filter_expr = True
        order_expr = period_expr
    else:  # month
        period_expr = func.strftime("%Y-%m", Transaction.transaction_date)
        filter_expr = True
        order_expr = period_expr

    query = (
        select(
            period_expr.label("period"),
            func.sum(case((Transaction.type == TransactionType.EXPENSE, Transaction.base_amount), else_=0)).label("expense"),
            func.sum(case(
                (Transaction.type == TransactionType.INCOME, Transaction.base_amount),
                (Transaction.type == TransactionType.REFUND, Transaction.base_amount),
                else_=0,
            )).label("income"),
        )
        .where(Transaction.user_id == user_id, filter_expr)
        .group_by("period")
        .order_by(order_expr)
    )

    result = await db.execute(query)
    rows = result.all()

    if granularity == "month" and len(rows) > months:
        rows = rows[-months:]

    return [
        TrendItem(period=row[0], expense=row[1] or Decimal("0"), income=row[2] or Decimal("0"))
        for row in rows
    ]


@router.get("/calendar", response_model=list[CalendarDay])
async def get_calendar(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    year: int = Query(default=THIS_YEAR),
    month: int = Query(default=THIS_MONTH),
):
    result = await db.execute(
        select(
            func.strftime("%Y-%m-%d", Transaction.transaction_date).label("d"),
            func.sum(case((Transaction.type == TransactionType.EXPENSE, Transaction.base_amount), else_=0)).label("expense"),
            func.sum(case(
                (Transaction.type == TransactionType.INCOME, Transaction.base_amount),
                (Transaction.type == TransactionType.REFUND, Transaction.base_amount),
                else_=0,
            )).label("income"),
            func.count(),
        )
        .where(
            Transaction.user_id == user_id,
            extract("year", Transaction.transaction_date) == year,
            extract("month", Transaction.transaction_date) == month,
        )
        .group_by("d")
        .order_by("d")
    )
    rows = result.all()
    return [
        CalendarDay(date=row[0], expense=row[1] or Decimal("0"), income=row[2] or Decimal("0"), count=row[3])
        for row in rows
    ]


@router.get("/category-breakdown", response_model=list[CategoryItem])
async def get_category_breakdown(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    type: str = Query(default="expense", pattern="^(expense|income)$"),
):
    tx_type = TransactionType.EXPENSE if type == "expense" else TransactionType.INCOME
    refund_type = TransactionType.REFUND

    # For expense: only EXPENSE. For income: INCOME + REFUND
    if type == "expense":
        type_filter = Transaction.type == tx_type
    else:
        type_filter = Transaction.type.in_([tx_type, refund_type])

    query = (
        select(
            Transaction.source_category,
            func.sum(Transaction.base_amount),
            func.count(),
        )
        .where(
            Transaction.user_id == user_id,
            type_filter,
            Transaction.source_category.isnot(None),
            Transaction.source_category != "",
        )
    )

    if year is not None:
        query = query.where(extract("year", Transaction.transaction_date) == year)
    if month is not None:
        query = query.where(extract("month", Transaction.transaction_date) == month)

    query = query.group_by(Transaction.source_category).order_by(func.sum(Transaction.base_amount).desc())

    result = await db.execute(query)
    rows = result.all()

    total_amount = sum((row[1] or Decimal("0") for row in rows), Decimal("0"))

    return [
        CategoryItem(
            category=row[0] or "未分类",
            amount=row[1] or Decimal("0"),
            count=row[2],
            pct=round(float((row[1] or Decimal("0")) / total_amount * 100), 1) if total_amount > 0 else 0.0,
        )
        for row in rows
    ]


@router.get("/merchant-ranking", response_model=list[MerchantItem])
async def get_merchant_ranking(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    year: int | None = Query(default=None),
    month: int | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
):
    query = (
        select(
            Transaction.merchant_name,
            func.sum(Transaction.base_amount),
            func.count(),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.EXPENSE,
            Transaction.merchant_name.isnot(None),
            Transaction.merchant_name != "",
        )
    )

    if year is not None:
        query = query.where(extract("year", Transaction.transaction_date) == year)
    if month is not None:
        query = query.where(extract("month", Transaction.transaction_date) == month)

    query = query.group_by(Transaction.merchant_name).order_by(func.sum(Transaction.base_amount).desc()).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    return [
        MerchantItem(
            merchant=row[0],
            amount=row[1] or Decimal("0"),
            count=row[2],
        )
        for row in rows
    ]


@router.get("/account-balances", response_model=list[AccountBalanceItem])
async def get_account_balances(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            Account.id,
            Account.name,
            Account.current_balance,
            Account.account_type,
            Account.currency,
        ).where(
            Account.user_id == user_id,
            Account.is_active == True,
        )
    )
    rows = result.all()

    return [
        AccountBalanceItem(
            id=row[0],
            name=row[1],
            current_balance=row[2] or Decimal("0"),
            account_type=row[3].value if hasattr(row[3], 'value') else str(row[3]),
            currency=row[4],
        )
        for row in rows
    ]
