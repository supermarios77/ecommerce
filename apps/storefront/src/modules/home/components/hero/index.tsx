import { Button, Heading } from "@modules/common/components/ui";
import LocalizedClientLink from "@modules/common/components/localized-client-link";

const Hero = () => {
  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative bg-gradient-to-br from-ui-bg-subtle to-ui-bg-base">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-8">
        <span className="space-y-4">
          <Heading
            level="h1"
            className="text-4xl md:text-5xl leading-tight text-ui-fg-base font-semibold tracking-tight"
          >
            Discover Your Style
          </Heading>
          <Heading
            level="h2"
            className="text-xl md:text-2xl leading-relaxed text-ui-fg-subtle font-normal"
          >
            Curated collections for the modern lifestyle
          </Heading>
        </span>
        <LocalizedClientLink href="/store">
          <Button variant="primary" className="mt-4 px-8 py-3 text-base">
            Shop Now
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  );
};

export default Hero;
