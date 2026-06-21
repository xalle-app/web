export const HeroHeader = ({
  icon,
  title,
  subtitle,
  action,
  className = ''
}) => {
  return (
    <div className={`hero-header ${className}`}>
      <div className="hero-header__content">
        {icon && <div className="hero-header__icon">{icon}</div>}

        <div className="hero-header__text">
          <h2 className="hero-header__title">{title}</h2>
          {subtitle && <p className="hero-header__subtitle">{subtitle}</p>}
        </div>
      </div>

      {action && <div className="hero-header__action">{action}</div>}
    </div>
  );
};